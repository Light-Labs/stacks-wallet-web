import { useContext } from 'react';

import { useHasApprovedOperation } from '@app/features/ryder/hooks/use-has-approved-transaction';
import { LedgerWrapper } from '@app/features/ryder/components/ledger-wrapper';
import { LedgerTitle } from '@app/features/ryder/components/ledger-title';
import { Box, color, Flex } from '@stacks/ui';
import { LedgerScreenDetail } from '@app/features/ryder/components/ledger-screen-detail';
import { ledgerJwtSigningContext } from '@app/features/ryder/ledger-jwt-signing.context';
import { DeviceOperationApprovalStatus } from '@app/features/ryder/components/device-approval-status';
import SignLedgerTransaction from '@assets/images/ryder/ryder-logo.png';
import { colourhash_to_svg, hex_to_byte_array } from '@app/colourhash-ts/colourhash';

export function SignJwtHash() {
  const { jwtPayloadHash } = useContext(ledgerJwtSigningContext);
  const hasApprovedOperation = useHasApprovedOperation();

  return (
    <LedgerWrapper>
      <Box mt="tight">
        <img src={SignLedgerTransaction} width="228px" />
      </Box>
      <LedgerTitle mt="loose" mx="50px">
        Prove identity on your device
      </LedgerTitle>
      <DeviceOperationApprovalStatus
        status={hasApprovedOperation ? 'approved' : 'awaiting-approval'}
      />
      <Flex
        bg={color('bg-4')}
        borderRadius="16px"
        flexDirection="column"
        textAlign="left"
        px="extra-loose"
        py="extra-loose"
        width="100%"
      >
        <LedgerScreenDetail
          isFullPage={false}
          title="JWT Hash"
          tooltipLabel="This is a Sha256 hash of the JSON Web Token payload returned to the connecting app, which proves to the app you own the corresponding private key"
        >
          <div
            style={{ padding: '1em', background: '#000' }}
            dangerouslySetInnerHTML={{
              __html: colourhash_to_svg(new Uint8Array(hex_to_byte_array(jwtPayloadHash || '')), {
                rows: 2,
                spacing: 2,
              }),
            }}
          />
          {jwtPayloadHash}
        </LedgerScreenDetail>
      </Flex>
    </LedgerWrapper>
  );
}
