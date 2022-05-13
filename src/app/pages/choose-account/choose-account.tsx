import { memo, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Stack, Text } from '@stacks/ui';

import { useRouteHeader } from '@app/common/hooks/use-route-header';
import { Title } from '@app/components/typography';
import { AppIcon } from '@app/components/app-icon';
import { useWallet } from '@app/common/hooks/use-wallet';
import { useAppDetails } from '@app/common/hooks/auth/use-app-details';
import { Header } from '@app/components/header';
import { Accounts } from '@app/pages/choose-account/components/accounts';
import { POPUP_CENTER_WIDTH } from '@shared/constants';

export const ChooseAccount = memo(() => {
  const { name: appName } = useAppDetails();
  const { cancelAuthentication } = useWallet();

  useRouteHeader(<Header hideActions />);

  const handleUnmount = useCallback(async () => {
    cancelAuthentication();
  }, [cancelAuthentication]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleUnmount);
    return () => window.removeEventListener('beforeunload', handleUnmount);
  }, [handleUnmount]);

  return (
    <>
      <Flex alignItems="center" flexDirection="column" px="loose" width="100%">
        <Stack minWidth={`${POPUP_CENTER_WIDTH}px`} spacing="loose" textAlign="center">
          <AppIcon mt="extra-loose" mb="loose" size="72px" />
          <Stack spacing="base">
            <Title fontSize={4}>Choose an account</Title>
            <Text textStyle="caption">to connect to {appName}</Text>
          </Stack>
        </Stack>
        <Accounts />
      </Flex>
      <Outlet />
    </>
  );
});
