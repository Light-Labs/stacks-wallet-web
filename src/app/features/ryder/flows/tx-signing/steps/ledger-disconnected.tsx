import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { LedgerDisconnectedLayout } from '@app/features/ryder/steps/ledger-disconnected.layout';

export function LedgerDisconnected() {
  const ledgerNavigate = useLedgerNavigate();
  return (
    <LedgerDisconnectedLayout
      onClose={() => ledgerNavigate.cancelLedgerAction()}
      onConnectAgain={() => ledgerNavigate.toConnectStepAndTryAgain()}
    />
  );
}
