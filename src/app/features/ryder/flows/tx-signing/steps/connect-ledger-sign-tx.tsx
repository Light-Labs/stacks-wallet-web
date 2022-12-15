import { useContext } from 'react';

import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';
import { ledgerTxSigningContext } from '@app/features/ryder/flows/tx-signing/ledger-sign-tx.context';
import { ConnectLedgerLayout } from '@app/features/ryder/generic-steps/connect-device/connect-ledger.layout';
import { useWhenReattemptingLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';

export function ConnectLedgerSignTx() {
  const { signTransaction, latestDeviceResponse, awaitingDeviceConnection } =
    useContext(ledgerTxSigningContext);

  useWhenReattemptingLedgerConnection(() => signTransaction());

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      warning={<CommonLedgerDeviceInlineWarnings latestDeviceResponse={latestDeviceResponse} />}
      onConnectLedger={signTransaction}
      showInstructions={false}
    />
  );
}
