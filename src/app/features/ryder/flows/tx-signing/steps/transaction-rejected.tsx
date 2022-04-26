import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { TransactionRejectedLayout } from '@app/features/ryder/steps/transaction-rejected.layout';

export function LedgerTransactionRejected() {
  const ledgerNavigate = useLedgerNavigate();
  return <TransactionRejectedLayout onClose={() => ledgerNavigate.cancelLedgerAction()} />;
}
