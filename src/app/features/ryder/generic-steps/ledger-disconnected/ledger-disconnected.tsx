import { LedgerDisconnectedLayout } from '@app/features/ryder/generic-steps/ledger-disconnected/ledger-disconnected.layout';
import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';

export function LedgerDisconnected() {
  const ledgerNavigate = useLedgerNavigate();
  return (
    <LedgerDisconnectedLayout
      onClose={() => ledgerNavigate.cancelLedgerAction()}
      onConnectAgain={() => ledgerNavigate.toConnectStepAndTryAgain()}
    />
  );
}
