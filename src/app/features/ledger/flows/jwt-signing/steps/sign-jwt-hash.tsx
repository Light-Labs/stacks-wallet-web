import { useHasApprovedOperation } from '@app/features/ledger/hooks/use-has-approved-transaction';
import { LedgerWrapper } from '@app/features/ledger/components/ledger-wrapper';
import { LedgerTitle } from '@app/features/ledger/components/ledger-title';
import { LookingForLedgerLabel } from '@app/features/ledger/components/looking-for-ledger-label';

export function SignJwtHash() {
  const hasApprovedOperation = useHasApprovedOperation();

  return (
    <LedgerWrapper>
      <LedgerTitle mt="loose" mx="50px">
        Approve the JWT hash on your device
      </LedgerTitle>
      <LookingForLedgerLabel my="extra-loose">Waiting for your approval</LookingForLedgerLabel>
    </LedgerWrapper>
  );
}
