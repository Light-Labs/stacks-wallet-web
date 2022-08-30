import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LedgerError } from '@zondax/ledger-blockstack';
import get from 'lodash.get';

import { delay } from '@app/common/utils';
import {
  getAppVersion,
  prepareLedgerDeviceConnection,
  signLedgerTransaction,
  signTransactionWithSignature,
  useLedgerResponseState,
} from '@app/features/ryder/ledger-utils';
import { deserializeTransaction } from '@stacks/transactions';
import { LedgerTxSigningProvider } from '@app/features/ryder/ledger-tx-signing.context';
import { useCurrentAccount } from '@app/store/accounts/account.hooks';
import { BaseDrawer } from '@app/components/drawer/base-drawer';
import { useScrollLock } from '@app/common/hooks/use-scroll-lock';
import { useHardwareWalletTransactionBroadcast } from '@app/store/transactions/transaction.hooks';
import { logger } from '@shared/logger';

import { useLedgerNavigate } from '../../hooks/use-ledger-navigate';
import { useLedgerAnalytics } from '../../hooks/use-ledger-analytics.hook';
import { RouteUrls } from '@shared/route-urls';

export function LedgerSignTxContainer() {
  const location = useLocation();
  const navigate = useNavigate();
  const ledgerNavigate = useLedgerNavigate();
  const ledgerAnalytics = useLedgerAnalytics();
  useScrollLock(true);
  const account = useCurrentAccount();
  const hwWalletTxBroadcast = useHardwareWalletTransactionBroadcast();

  const [unsignedTransaction, setUnsignedTransaction] = useState<null | string>(null);

  useEffect(() => {
    const tx = get(location.state, 'tx');
    if (tx) setUnsignedTransaction(tx);
  }, [location.state]);

  useEffect(() => () => setUnsignedTransaction(null), []);

  const [latestDeviceResponse, setLatestDeviceResponse] = useLedgerResponseState();

  const [awaitingDeviceConnection, setAwaitingDeviceConnection] = useState(false);
  const [awaitingKeyVerification, setAwaitingKeyVerification] = useState(false);
  const [awaitingSignedTransaction, setAwaitingSignedTransaction] = useState(false);

  const signTransaction = async () => {
    if (!account) return;

    const stacksApp = await prepareLedgerDeviceConnection({
      setLoadingState: setAwaitingDeviceConnection,
      onError() {
        ledgerNavigate.toErrorStep();
      },
    });

    if (!stacksApp) return;

    const versionInfo = await getAppVersion(stacksApp);
    ledgerAnalytics.trackDeviceVersionInfo(versionInfo);
    setLatestDeviceResponse(versionInfo);

    if (versionInfo.deviceLocked) {
      setAwaitingDeviceConnection(false);
      return;
    }

    if (versionInfo.returnCode !== LedgerError.NoErrors) {
      logger.error('Return code from device has error', versionInfo);
      return;
    }

    setAwaitingKeyVerification(true);
    ledgerNavigate.toActivityHappeningOnDeviceStep();
    await delay(1000);
    setAwaitingKeyVerification(false);

    try {
      setAwaitingSignedTransaction(true);
      ledgerNavigate.toConnectionSuccessStep();
      await delay(1000);
      if (!unsignedTransaction) throw new Error('No unsigned tx');

      ledgerNavigate.toAwaitingDeviceOperation({ hasApprovedOperation: false });

      const resp = await signLedgerTransaction(stacksApp)(
        Buffer.from(unsignedTransaction, 'hex'),
        account.index
      );

      // eslint-disable-next-line no-console
      console.log('sign-tx-container', resp);

      // Assuming here that public keys are wrong. Alternatively, we may want
      // to proactively check the key before signing
      if (resp.returnCode === LedgerError.DataIsInvalid) {
        setAwaitingSignedTransaction(false);
        ledgerNavigate.toDeviceInvalidTx();
        return;
      }

      if (resp.returnCode === LedgerError.TransactionRejected) {
        setAwaitingSignedTransaction(false);
        ledgerNavigate.toTransactionRejectedStep();
        ledgerAnalytics.transactionSignedOnLedgerRejected();

        return;
      }

      if (resp.returnCode !== LedgerError.NoErrors) {
        setAwaitingSignedTransaction(false);
        throw new Error('Some other error');
      }

      ledgerNavigate.toAwaitingDeviceOperation({ hasApprovedOperation: true });

      await delay(1000);

      // Ryder returns signed tx
      // Ledger returns signature only: const signedTx =  signTransactionWithSignature(unsignedTransaction, resp.signatureVRS);
      const signedTx = deserializeTransaction(Buffer.from(resp.data).toString('hex'));
      // eslint-disable-next-line no-console
      console.log({ signedTx });
      ledgerAnalytics.transactionSignedOnLedgerSuccessfully();

      await hwWalletTxBroadcast({ signedTx });
      setAwaitingSignedTransaction(false);
      navigate(RouteUrls.Home);
    } catch (e) {
      setAwaitingSignedTransaction(false);
      ledgerNavigate.toDeviceDisconnectStep();
    }
  };

  const allowUserToGoBack = get(location.state, 'goBack');
  const onCancelConnectLedger = allowUserToGoBack
    ? ledgerNavigate.cancelLedgerActionAndReturnHome
    : ledgerNavigate.cancelLedgerAction;

  const ledgerContextValue = {
    transaction: unsignedTransaction ? deserializeTransaction(unsignedTransaction) : null,
    signTransaction,
    latestDeviceResponse,
    awaitingDeviceConnection,
    onCancelConnectLedger,
  };

  return (
    <LedgerTxSigningProvider value={ledgerContextValue}>
      <BaseDrawer
        enableGoBack={allowUserToGoBack}
        isShowing
        isWaitingOnPerformedAction={
          awaitingDeviceConnection || awaitingKeyVerification || awaitingSignedTransaction
        }
        onClose={onCancelConnectLedger}
        pauseOnClickOutside
        waitingOnPerformedActionMessage="Ryder device in use"
      >
        <Outlet />
      </BaseDrawer>
    </LedgerTxSigningProvider>
  );
}
