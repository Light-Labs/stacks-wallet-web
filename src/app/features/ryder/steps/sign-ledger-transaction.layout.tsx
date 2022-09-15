/* eslint-disable no-console */
import { color, Box, Flex } from '@stacks/ui';

import SignLedgerTransaction from '@assets/images/ryder/ryder-logo.png';
import { DividerSeparator } from '@app/components/divider-separator';
import { LedgerTitle } from '../components/ledger-title';
import { LedgerWrapper } from '../components/ledger-wrapper';
import { LedgerScreenDetail } from '../components/ledger-screen-detail';
import { DeviceOperationApprovalStatus } from '../components/device-approval-status';
import { colourhash_to_svg, hex_to_byte_array } from '@app/colourhash-ts/colourhash';

interface SignLedgerTransactionLayoutProps {
  details: [string, string, string?][];
  isFullPage: boolean;
  status: 'awaiting-approval' | 'approved';
  txid: string | undefined;
}
export function SignLedgerTransactionLayout({
  details,
  isFullPage,
  status,
  txid,
}: SignLedgerTransactionLayoutProps) {
  console.log({ txid });
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
        <div
          style={{ padding: '1em', background: '#000' }}
          dangerouslySetInnerHTML={{
            __html: colourhash_to_svg(new Uint8Array(hex_to_byte_array(txid || '')), {
              rows: 2,
              spacing: 2,
            }),
          }}
        />

        <DividerSeparator>
          {details.map(([title, value, tooltipLabel]) => (
            <LedgerScreenDetail
              key={value}
              isFullPage={isFullPage}
              title={title}
              tooltipLabel={tooltipLabel}
            >
              {value}
            </LedgerScreenDetail>
          ))}
        </DividerSeparator>
      </Flex>
    </LedgerWrapper>
  );
}
