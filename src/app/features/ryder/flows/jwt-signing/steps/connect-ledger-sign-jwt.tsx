import { useContext } from 'react';

import { CommonLedgerDeviceInlineWarnings } from '@app/features/ryder/components/ledger-inline-warnings';
import { ledgerJwtSigningContext } from '@app/features/ryder/flows/jwt-signing/ledger-sign-jwt.context';
import { ConnectLedgerLayout } from '@app/features/ryder/generic-steps';

export function ConnectLedgerSignJwt() {
  const { signJwtPayload, latestDeviceResponse, awaitingDeviceConnection } =
    useContext(ledgerJwtSigningContext);

  return (
    <ConnectLedgerLayout
      awaitingLedgerConnection={awaitingDeviceConnection}
      warning={<CommonLedgerDeviceInlineWarnings latestDeviceResponse={latestDeviceResponse} />}
      onConnectLedger={signJwtPayload}
      showInstructions={false}
    />
  );
}
