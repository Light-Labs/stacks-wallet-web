import RyderLogo from '@assets/images/ryder/ryder-logo.png';
import { LedgerSuccessLabel } from '../components/success-label';
import { LedgerConnectInstructionTitle } from '../components/ledger-title';
import { LedgerWrapper } from '../components/ledger-wrapper';

export function ConnectLedgerSuccessLayout() {
  return (
    <LedgerWrapper>
      <img src={RyderLogo} width="267px" height="55px" />
      <LedgerConnectInstructionTitle mt="loose" mx="50px" />
      <LedgerSuccessLabel my="extra-loose">Connected!</LedgerSuccessLabel>
    </LedgerWrapper>
  );
}
