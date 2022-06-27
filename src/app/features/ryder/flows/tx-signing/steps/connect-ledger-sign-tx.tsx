import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import get from 'lodash.get';

import { ConnectLedgerLayout } from '@app/features/ryder/steps/connect-ledger.layout';
import { useWhenReattemptingLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';

import { ledgerTxSigningContext } from '@app/features/ryder/ledger-tx-signing.context';
import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';

export function ConnectLedgerSignTx() {
  const location = useLocation();

  const { signTransaction, latestDeviceResponse, awaitingDeviceConnection } =
    useContext(ledgerTxSigningContext);

  const isLookingForLedger = get(location, 'state.isLookingForLedger');

  useWhenReattemptingLedgerConnection(() => signTransaction());

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      isLookingForLedger={isLookingForLedger}
      warning={<CommonLedgerDeviceInlineWarnings latestDeviceResponse={latestDeviceResponse} />}
      onConnectLedger={signTransaction}
      showInstructions={false}
    />
  );
}
