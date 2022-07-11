import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { LedgerDeviceInvalidTxLayout } from '@app/features/ryder/steps/device-invalid-tx.layout';

export function LedgerDeviceInvalidTx() {
  const ledgerNavigate = useLedgerNavigate();
  return <LedgerDeviceInvalidTxLayout onClose={() => ledgerNavigate.cancelLedgerAction()} />;
}
