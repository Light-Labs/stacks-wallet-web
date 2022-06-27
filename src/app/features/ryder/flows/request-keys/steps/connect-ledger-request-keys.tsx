import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import get from 'lodash.get';

import { ConnectLedgerLayout } from '@app/features/ryder/steps/connect-ledger.layout';
import { useWhenReattemptingLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';
import { ledgerRequestKeysContext } from '@app/features/ryder/ledger-request-keys.context';
import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';

export const ConnectLedgerRequestKeys = () => {
  const location = useLocation();

  const {
    pullPublicKeysFromDevice,
    latestDeviceResponse,
    awaitingDeviceConnection,
    outdatedAppVersionWarning,
  } = useContext(ledgerRequestKeysContext);

  const isLookingForLedger = get(location, 'state.isLookingForLedger');

  useWhenReattemptingLedgerConnection(() => pullPublicKeysFromDevice());

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      isLookingForLedger={isLookingForLedger}
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
