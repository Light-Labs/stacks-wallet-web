/* eslint-disable no-console */
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LedgerError } from '@zondax/ledger-blockstack';
import { Box } from '@stacks/ui';
import { logger } from '@shared/logger';
import get from 'lodash.get';

import { delay } from '@app/common/utils';
import {
  addSignatureToAuthResponseJwt,
  exportEncryptedAppPrivateKey,
  getAppVersion,
  getSha256HashOfJwtAuthPayload,
  prepareLedgerDeviceConnection,
  signLedgerJwtHash,
  useLedgerResponseState,
} from '@app/features/ryder/ledger-utils';
import { getAddressFromPublicKey, TransactionVersion } from '@stacks/transactions';

import { useCurrentAccount } from '@app/store/accounts/account.hooks';
import { BaseDrawer } from '@app/components/drawer';
import { makeLedgerCompatibleUnsignedAuthResponsePayload } from '@app/common/unsafe-auth-response';
import { useKeyActions } from '@app/common/hooks/use-key-actions';

import { useLedgerNavigate } from '../../hooks/use-ledger-navigate';
import { LedgerJwtSigningProvider } from '../../ledger-jwt-signing.context';
import { finalizeAuthResponse } from '@app/common/actions/finalize-auth-response';
import { useOnboardingState } from '@app/common/hooks/auth/use-onboarding-state';
import { useScrollLock } from '@app/common/hooks/use-scroll-lock';
import {
  doPublicKeysMatchIssuer,
  doSignaturesMatchPublicKeys,
  isExpirationDateValid,
  isIssuanceDateValid,
} from '@stacks/auth';
import { encrypt, getAppPrivateKey } from '@stacks/wallet-sdk';

export function LedgerSignJwtContainer() {
  const location = useLocation();
  const ledgerNavigate = useLedgerNavigate();
  useScrollLock(true);

  const account = useCurrentAccount();
  const keyActions = useKeyActions();
  const { decodedAuthRequest, authRequest } = useOnboardingState();

  const [accountIndex, setAccountIndex] = useState<null | number>(null);

  useEffect(() => {
    const index = parseInt(get(location.state, 'index'), 10);
    if (Number.isFinite(index)) setAccountIndex(index);
    return () => setAccountIndex(null);
  }, [location.state]);

  const [latestDeviceResponse, setLatestDeviceResponse] = useLedgerResponseState();

  const [awaitingDeviceConnection, setAwaitingDeviceConnection] = useState(false);
  const [jwtPayloadHash, setJwtPayloadHash] = useState<null | string>(null);

  const signJwtPayload = async () => {
    if (!account || !decodedAuthRequest || !authRequest || accountIndex === null) return;

    const stacks = await prepareLedgerDeviceConnection({
      setLoadingState: setAwaitingDeviceConnection,
      onError() {
        ledgerNavigate.toErrorStep();
      },
    });

    if (!stacks) return;
    const versionInfo = await getAppVersion(stacks);
    setLatestDeviceResponse(versionInfo);

    if (versionInfo.deviceLocked) {
      setAwaitingDeviceConnection(false);
      return;
    }

    if (versionInfo.returnCode !== LedgerError.NoErrors) {
      logger.error('Return code from device has error', versionInfo);
      return;
    }

    try {
      ledgerNavigate.toConnectionSuccessStep();
      await delay(1000);

      const appDomain = decodedAuthRequest.domain_name;
      const transitPublicKey = decodedAuthRequest.public_keys[0];

      /* disabled for now
      console.log("export private app key");
      const encrytpedAppPrivateKey = await exportEncryptedAppPrivateKey(stacks)(
        appDomain,
        transitPublicKey,
        accountIndex
      );
      console.log(encrytpedAppPrivateKey);
      */
      const encrytpedAppPrivateKey = undefined;

      const authResponsePayload = await makeLedgerCompatibleUnsignedAuthResponsePayload({
        // in payload: {.. public_keys:[dataPublicKey]..}
        dataPublicKey: account.dataPublicKey,
        // in payload: {.. profile:profile..}
        profile: {
          stxAddress: {
            testnet: getAddressFromPublicKey(
              (account as any).stxPublicKey,
              TransactionVersion.Testnet
            ),
            mainnet: getAddressFromPublicKey(
              (account as any).stxPublicKey,
              TransactionVersion.Mainnet
            ),
          },
        },
        // in payload: {.. private_key: encryptedAppPrivateKey..}
        encrytpedAppPrivateKey,
      });

      setJwtPayloadHash(getSha256HashOfJwtAuthPayload(authResponsePayload));

      ledgerNavigate.toAwaitingDeviceOperation({ hasApprovedOperation: false });

      const resp = await signLedgerJwtHash(stacks)(authResponsePayload, accountIndex);

      if (resp.returnCode === LedgerError.TransactionRejected) {
        ledgerNavigate.toTransactionRejectedStep();
        return;
      }

      ledgerNavigate.toAwaitingDeviceOperation({ hasApprovedOperation: true });

      const authResponse = addSignatureToAuthResponseJwt(authResponsePayload, resp.signatureDER);
      // eslint-disable-next-line no-console
      console.log(
        'sign checks',
        authResponse,
        await isExpirationDateValid(authResponse),
        await isIssuanceDateValid(authResponse),
        await doSignaturesMatchPublicKeys(authResponse),
        await doPublicKeysMatchIssuer(authResponse)
      );
      await delay(600);
      keyActions.switchAccount(accountIndex);
      finalizeAuthResponse({ decodedAuthRequest, authRequest, authResponse });
    } catch (e) {
      console.log(e);
      ledgerNavigate.toDeviceDisconnectStep();
    }
  };

  const onCancelConnectLedger = ledgerNavigate.cancelLedgerAction;

  const ledgerContextValue = {
    signJwtPayload,
    jwtPayloadHash,
    latestDeviceResponse,
    awaitingDeviceConnection,
    onCancelConnectLedger,
  };

  return (
    <LedgerJwtSigningProvider value={ledgerContextValue}>
      <BaseDrawer title={<Box />} isShowing onClose={onCancelConnectLedger}>
        <Outlet />
      </BaseDrawer>
    </LedgerJwtSigningProvider>
  );
}
