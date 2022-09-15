import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRouteHeader } from '@app/common/hooks/use-route-header';
import { useAnalytics } from '@app/common/hooks/analytics/use-analytics';
import { useOnboardingState } from '@app/common/hooks/auth/use-onboarding-state';
import { Header } from '@app/components/header';
import { RouteUrls } from '@shared/route-urls';
import { WelcomeLayout } from './welcome.layout';
import { useHasAllowedDiagnostics } from '@app/store/onboarding/onboarding.hooks';
import { useKeyActions } from '@app/common/hooks/use-key-actions';
import { doesBrowserSupportWebUsbApi, whenPageMode } from '@app/common/utils';
import { openIndexPageInNewTab } from '@app/common/utils/open-in-new-tab';
import { prepareLedgerDeviceConnection } from '@app/features/ryder/ledger-utils';
export const WelcomePage = memo(() => {
  const [hasAllowedDiagnostics] = useHasAllowedDiagnostics();
  const navigate = useNavigate();
  const { decodedAuthRequest } = useOnboardingState();
  const analytics = useAnalytics();
  const keyActions = useKeyActions();

  useRouteHeader(<Header hideActions />);

  const [isGeneratingWallet, setIsGeneratingWallet] = useState(false);

  const startOnboarding = useCallback(async () => {
    setIsGeneratingWallet(true);

    const stacksApp = await prepareLedgerDeviceConnection({
      setLoadingState: () => {},
      onError() {
        console.log('error');
      },
    });

    if (!stacksApp) return;
    const result = await stacksApp.setupDevice();
    console.log(result);
    navigate(RouteUrls.Home);
  }, [navigate]);

  useEffect(() => {
    if (hasAllowedDiagnostics === undefined) navigate(RouteUrls.RequestDiagnostics);

    return () => setIsGeneratingWallet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageModeRoutingAction = (url: RouteUrls) =>
    whenPageMode({
      full() {
        navigate(url);
      },
      popup() {
        void openIndexPageInNewTab(`${RouteUrls.Onboarding}/${url}`);
      },
    });

  const supportsWebUsbAction = pageModeRoutingAction(RouteUrls.ConnectLedger);
  const doesNotSupportWebUsbAction = pageModeRoutingAction(RouteUrls.LedgerUnsupportedBrowser);

  return (
    <WelcomeLayout
      isGeneratingWallet={isGeneratingWallet}
      onSelectConnectLedger={() =>
        doesBrowserSupportWebUsbApi() ? supportsWebUsbAction() : doesNotSupportWebUsbAction()
      }
      onSelectConnectRyder={() => {
        navigate(RouteUrls.ConnectLedger);
      }}
      onStartOnboarding={() => startOnboarding()}
      onRestoreWallet={() => navigate(RouteUrls.SignIn)}
    />
  );
});
