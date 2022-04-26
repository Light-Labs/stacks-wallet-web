import { useNavigate } from 'react-router-dom';

import { RouteUrls } from '@shared/route-urls';

import { ConnectLedgerErrorLayout } from '@app/features/ryder/steps/connect-ledger-error.layout';
import { immediatelyAttemptLedgerConnection } from '@app/features/ryder/hooks/use-when-reattempt-ledger-connection';
import { useLatestLedgerError } from '@app/features/ryder/hooks/use-ledger-latest-route-error.hook';

export const ConnectLedgerRequestKeysError = () => {
  const navigate = useNavigate();
  const latestLedgerError = useLatestLedgerError();

  return (
    <ConnectLedgerErrorLayout
      warningText={latestLedgerError}
      onCancelConnectLedger={() => navigate(RouteUrls.Onboarding)}
      onTryAgain={() =>
        navigate(`../${RouteUrls.ConnectLedger}`, {
          replace: true,
          state: { [immediatelyAttemptLedgerConnection]: true },
        })
      }
    />
  );
};
