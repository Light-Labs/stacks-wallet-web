import { Box, BoxProps } from '@stacks/ui';

export function WalletTypeLedgerIcon(props: BoxProps) {
  return (
    <Box
      as="img"
      src="assets/images/ryder/ryder-logo-24x24.png"
      width="24px"
      height="24px"
      {...props}
    />
  );
}
