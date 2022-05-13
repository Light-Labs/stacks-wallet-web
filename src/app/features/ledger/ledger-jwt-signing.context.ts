import { createContext } from 'react';

import { noop } from '@app/common/utils';
import { getAppVersion } from './ledger-utils';

export interface LedgerJwtSigningProvider {
  latestDeviceResponse: null | Awaited<ReturnType<typeof getAppVersion>>;
  awaitingDeviceConnection: boolean;
  signJwtPayload(): Promise<void> | void;
}

export const ledgerJwtSigningContext = createContext<LedgerJwtSigningProvider>({
  latestDeviceResponse: null,
  awaitingDeviceConnection: false,
  signJwtPayload: noop,
});

export const LedgerJwtSigningProvider = ledgerJwtSigningContext.Provider;
