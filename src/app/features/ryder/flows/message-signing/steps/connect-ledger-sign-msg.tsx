import { useContext } from 'react';

import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';
import { ConnectLedgerLayout } from '@app/features/ryder/generic-steps/connect-device/connect-ledger.layout';
import { useWhenReattemptingLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';

import { ledgerMsgSigningContext } from '../ledger-sign-msg.context';

export function ConnectLedgerSignMsg() {
  const { signMessage, latestDeviceResponse, awaitingDeviceConnection } =
    useContext(ledgerMsgSigningContext);

  useWhenReattemptingLedgerConnection(() => signMessage());

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      warning={<CommonLedgerDeviceInlineWarnings latestDeviceResponse={latestDeviceResponse} />}
      onConnectLedger={signMessage}
      showInstructions={false}
    />
  );
}
