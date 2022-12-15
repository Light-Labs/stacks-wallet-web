import { useLocationState } from '@app/common/hooks/use-location-state';
import { LedgerOperationRejectedLayout } from '@app/features/ryder/generic-steps/operation-rejected/operation-rejected.layout';
import { useLedgerNavigate } from '@app/features/ryder/hooks/use-ledger-navigate';

export function OperationRejected() {
  const ledgerNavigate = useLedgerNavigate();
  const description = useLocationState('description', 'The operation on device was rejected');
  return (
    <LedgerOperationRejectedLayout
      description={description}
      onClose={() => ledgerNavigate.cancelLedgerAction()}
    />
  );
}
