import { Suspense, lazy } from 'react';

import { Box } from '@stacks/ui';

import { Divider } from '@app/components/divider';
import { ExternalLink } from '@app/components/external-link';
import { PrimaryButton } from '@app/components/primary-button';
import { Caption } from '@app/components/typography';

import { LedgerConnectInstructionTitle } from '../../components/ledger-title';
import { LedgerWrapper } from '../../components/ledger-wrapper';
import RyderLogo from '@assets/images/ryder/ryder-logo.png';

interface ConnectLedgerLayoutProps {
  awaitingLedgerConnection: boolean;
  warning: React.ReactNode;
  showInstructions: boolean;
  onConnectLedger(): void;
}
export function ConnectLedgerLayout(props: ConnectLedgerLayoutProps) {
  const { onConnectLedger, warning, showInstructions, awaitingLedgerConnection } = props;

  return (
    <LedgerWrapper>
      <Box position="relative" width="100%" minHeight="120px">
      <img src={RyderLogo} />
      </Box>
      {/* <img src={ConnectLedger} width="299" height="97" /> */}
      <LedgerConnectInstructionTitle mt="extra-loose" mx="50px" />
      <PrimaryButton
        height="40px"
        my="base"
        onClick={onConnectLedger}
        isLoading={awaitingLedgerConnection}
      >
        Connect
      </PrimaryButton>
      <Box mb="base" mx="extra-loose">
        {warning}
      </Box>
      {showInstructions ? (
        <Box width="100%">
          <Divider />
          <Caption mb="tight" mt="loose">
            First time using Ryder on Hiro Wallet?
          </Caption>
          <ExternalLink
            href="https://github.com/light-labs/stacks-wallet-web"
            fontSize={1}
          >
            Learn about the current state
          </ExternalLink>
        </Box>
      ) : null}
    </LedgerWrapper>
  );
}
