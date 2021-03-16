import React, { memo } from 'react';
import { Box, Button, color, useClipboard, Flex, FlexProps, Stack } from '@stacks/ui';
import { PopupContainer } from '@components/popup/container';
import { useAnalytics } from '@common/hooks/use-analytics';
import { ScreenPaths } from '@store/onboarding/types';
import { useWallet } from '@common/hooks/use-wallet';
import { Toast } from '@components/toast';
import { getAccountDisplayName } from '@stacks/wallet-sdk';
import { Caption, Title } from '@components/typography';
import { createQR } from '@vkontakte/vk-qr';
import { truncateMiddle } from '@stacks/ui-utils';
import { Tooltip } from '@components/tooltip';

const QRcode: React.FC<{ principal: string } & FlexProps> = memo(({ principal, ...rest }) => {
  const qrSvg = React.useMemo(
    () =>
      createQR(principal, {
        ecc: 0,
        qrSize: 180,
        backgroundColor: color('text-body'),
        foregroundColor: color('invert'),
      }),
    [principal]
  );

  const qr = <Box dangerouslySetInnerHTML={{ __html: qrSvg }} />; // Bad?

  return (
    <Flex
      alignItems="center"
      justifyContent="center"
      p="loose"
      borderRadius="18px"
      boxShadow="mid"
      border="1px solid"
      borderColor={color('border')}
      position="relative"
      mx="auto"
      {...rest}
    >
      {qr}
      <Box position="absolute">{qr}</Box>
    </Flex>
  );
});

export const PopupReceive: React.FC = () => {
  const { currentAccount, currentAccountStxAddress } = useWallet();
  const { doChangeScreen } = useAnalytics();
  const address = currentAccountStxAddress || '';
  const { onCopy, hasCopied } = useClipboard(address);
  return (
    <PopupContainer title="Receive" onClose={() => doChangeScreen(ScreenPaths.POPUP_HOME)}>
      <Toast show={hasCopied} />
      <Box mt="extra-loose" textAlign="center" mx="auto">
        <QRcode principal={address} />
      </Box>
      <Stack spacing="base-loose" width="100%" mt="extra-loose" textAlign="center">
        {currentAccount && (
          <Title fontSize={3} lineHeight="1rem">
            {getAccountDisplayName(currentAccount)}
          </Title>
        )}
        <Tooltip interactive placement="bottom" label={address}>
          <Caption userSelect="none">{truncateMiddle(address, 8)}</Caption>
        </Tooltip>
      </Stack>
      <Box mt="auto">
        <Button width="100%" onClick={onCopy}>
          Copy your address
        </Button>
      </Box>
    </PopupContainer>
  );
};
