import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { LedgerOperationRejectedLayout } from '@app/features/ryder/steps/transaction-rejected.layout';

export function LedgerJwtSigningRejected() {
  const ledgerNavigate = useLedgerNavigate();
  return (
    <LedgerOperationRejectedLayout
      description="Signing operation on Ledger rejected"
      onClose={() => ledgerNavigate.cancelLedgerAction()}
    />
  );
}
