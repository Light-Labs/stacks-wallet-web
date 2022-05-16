import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { LedgerOperationRejectedLayout } from '@app/features/ryder/steps/transaction-rejected.layout';

export function LedgerTransactionRejected() {
  const ledgerNavigate = useLedgerNavigate();
  return (
    <LedgerOperationRejectedLayout
      description="The transaction on your Ledger was rejected"
      onClose={() => ledgerNavigate.cancelLedgerAction()}
    />
  );
}
