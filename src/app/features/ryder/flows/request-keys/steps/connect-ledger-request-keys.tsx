import { useContext } from 'react';

import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';
import { ledgerRequestKeysContext } from '@app/features/ryder/flows/request-keys/ledger-request-keys.context';
import { ConnectLedgerLayout } from '@app/features/ryder/generic-steps/connect-device/connect-ledger.layout';
import { useWhenReattemptingLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';

export const ConnectLedgerRequestKeys = () => {
  const {
    pullPublicKeysFromDevice,
    latestDeviceResponse,
    awaitingDeviceConnection,
    outdatedAppVersionWarning,
  } = useContext(ledgerRequestKeysContext);

  useWhenReattemptingLedgerConnection(() => pullPublicKeysFromDevice());

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      warning={
        <CommonLedgerDeviceInlineWarnings
          latestDeviceResponse={latestDeviceResponse}
          outdatedLedgerAppWarning={outdatedAppVersionWarning}
        />
      }
      showInstructions
      onConnectLedger={pullPublicKeysFromDevice}
    />
  );
};
