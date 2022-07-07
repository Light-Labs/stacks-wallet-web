import { FiInfo } from 'react-icons/fi';
import { color, Box, Flex, Text, Stack } from '@stacks/ui';

import SignLedgerTransaction from '@assets/images/ryder/ryder-logo.png';
import { Tooltip } from '@app/components/tooltip';
import { Caption } from '@app/components/typography';
import { DividerSeparator } from '@app/components/divider-separator';
import { LedgerTitle } from '../components/ledger-title';
import { LookingForLedgerLabel } from '../components/looking-for-ledger-label';
import { LedgerWrapper } from '../components/ledger-wrapper';
import { LedgerScreenDetail } from '../components/ledger-screen-detail';
import { DeviceOperationApprovalStatus } from '../components/device-approval-status';

interface SignLedgerTransactionLayoutProps {
  details: [string, string, string?][];
  isFullPage: boolean;
  status: 'awaiting-approval' | 'approved';
}
export function SignLedgerTransactionLayout({
  details,
  isFullPage,
  status,
}: SignLedgerTransactionLayoutProps) {
  return (
    <LedgerWrapper>
      <Box mt="tight">
        <img src={SignLedgerTransaction} width="228px" />
      </Box>
      <LedgerTitle mt="loose" mx="50px">
        Verify the transaction details on your Ryder
      </LedgerTitle>
      <DeviceOperationApprovalStatus status={status} />
      <Flex
        bg={color('bg-4')}
        borderRadius="16px"
        flexDirection="column"
        textAlign="left"
        px="extra-loose"
        py="extra-loose"
        width="100%"
      >
        <DividerSeparator>
          {details.map(([title, value, tooltipLabel]) => (
            <LedgerScreenDetail isFullPage={isFullPage} title={title} tooltipLabel={tooltipLabel}>
              {value}
            </LedgerScreenDetail>
          ))}
        </DividerSeparator>
      </Flex>
    </LedgerWrapper>
  );
}
