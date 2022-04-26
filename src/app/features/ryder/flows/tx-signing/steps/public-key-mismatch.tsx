import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';
import { PublicKeyMismatchLayout } from '@app/features/ryder/steps/public-key-mismatch.layout';

export function LedgerPublicKeyMismatch() {
  const ledgerNavigate = useLedgerNavigate();
  return (
    <PublicKeyMismatchLayout
      onClose={() => ledgerNavigate.cancelLedgerAction()}
      onTryAgain={() => ledgerNavigate.toConnectStepAndTryAgain()}
    />
  );
}
