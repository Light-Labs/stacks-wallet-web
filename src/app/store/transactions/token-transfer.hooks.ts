import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-async-hook';
import { atom } from 'jotai';
import { useAtomValue, waitForAll } from 'jotai/utils';
import { TransactionTypes } from '@stacks/connect';
import {
  bufferCVFromString,
  ClarityValue,
  createAddress,
  createEmptyAddress,
  noneCV,
  PostConditionMode,
  serializeCV,
  someCV,
  standardPrincipalCVFromAddress,
  uintCV,
} from '@stacks/transactions';

import { ftUnshiftDecimals, stxToMicroStx } from '@app/common/stacks-utils';
import { TransactionFormValues } from '@app/common/transactions/transaction-utils';
import { makePostCondition } from '@app/store/transactions/transaction.hooks';
import { useNextNonce } from '@app/query/nonce/account-nonces.hooks';
import { currentAccountState, currentAccountStxAddressState } from '@app/store/accounts/accounts';
import { currentStacksNetworkState } from '@app/store/network/networks';
import {
  generateUnsignedTransaction,
  GenerateUnsignedTransactionOptions,
} from '@app/common/transactions/generate-unsigned-txs';

import { useSelectedAssetItem } from '../assets/asset.hooks';

function useMakeFungibleTokenTransfer() {
  const asset = useSelectedAssetItem();
  const currentAccount = useAtomValue(currentAccountState);
  const network = useAtomValue(currentStacksNetworkState);
  const stxAddress = useAtomValue(currentAccountStxAddressState);

  return useMemo(() => {
    if (!stxAddress) return;

    if (asset && currentAccount && stxAddress) {
      const { contractName, contractAddress, name: assetName } = asset;
      return {
        asset,
        stxAddress,
        network,
        assetName,
        contractAddress,
        contractName,
      };
    }
    return;
  }, [asset, currentAccount, network, stxAddress]);
}

const stxTokenTransferAtomDeps = atom(get =>
  get(
    waitForAll({
      network: currentStacksNetworkState,
      account: currentAccountState,
    })
  )
);

export function useGenerateStxTokenTransferUnsignedTx() {
  const address = useAtomValue(currentAccountStxAddressState);
  const { nonce } = useNextNonce();
  const { network, account } = useAtomValue(stxTokenTransferAtomDeps);

  return useCallback(
    async (values?: TransactionFormValues) => {
      if (!account || !address) return;

      const options: GenerateUnsignedTransactionOptions = {
        publicKey: account.stxPublicKey,
        nonce: Number(values?.nonce) || nonce,
        fee: stxToMicroStx(values?.fee || 0).toNumber(),
        txData: {
          txType: TransactionTypes.STXTransfer,
          // Using account address here as a fallback for a fee estimation
          recipient: values?.recipient || account.address,
          amount: values?.amount ? stxToMicroStx(values?.amount).toString(10) : '0',
          memo: values?.memo || undefined,
          network: network,
          // Coercing type here as we don't have the public key
          // as expected by STXTransferPayload type.
          // This code will likely need to change soon with Ledger
          // work, and coercion allows us to remove lots of type mangling
          // and types are out of sync with @stacks/connect
        } as any,
      };
      return generateUnsignedTransaction(options);
    },
    [address, network, account, nonce]
  );
}

export function useStxTokenTransferUnsignedTxState(values?: TransactionFormValues) {
  const generateTx = useGenerateStxTokenTransferUnsignedTx();
  const { nonce } = useNextNonce();
  const address = useAtomValue(currentAccountStxAddressState);
  const { network, account } = useAtomValue(stxTokenTransferAtomDeps);

  const tx = useAsync(async () => {
    return generateTx(values ?? undefined);
  }, [values, address, network, account, nonce]);

  return tx.result;
}

export function useGenerateFtTokenTransferUnsignedTx() {
  const assetTransferState = useMakeFungibleTokenTransfer();
  const { nonce } = useNextNonce();
  const selectedAsset = useSelectedAssetItem();
  const address = useAtomValue(currentAccountStxAddressState);
  const account = useAtomValue(currentAccountState);

  return useCallback(
    async (values?: TransactionFormValues) => {
      if (!address || !assetTransferState || !selectedAsset || !account) return;

      const { network, assetName, contractAddress, contractName, stxAddress } = assetTransferState;

      const functionName = 'transfer';

      const realAmount =
        selectedAsset.type === 'ft'
          ? ftUnshiftDecimals(values?.amount || 0, selectedAsset?.meta?.decimals || 0)
          : values?.amount || 0;

      const postConditionOptions = {
        contractAddress,
        contractName,
        assetName,
        stxAddress,
        amount: realAmount,
      };

      const postConditions = [makePostCondition(postConditionOptions)];

      // (transfer (uint principal principal) (response bool uint))
      const functionArgs: ClarityValue[] = [
        uintCV(realAmount),
        standardPrincipalCVFromAddress(createAddress(stxAddress)),
        standardPrincipalCVFromAddress(
          values ? createAddress(values?.recipient || '') : createEmptyAddress()
        ),
      ];

      if (selectedAsset.hasMemo) {
        functionArgs.push(
          values?.memo !== '' ? someCV(bufferCVFromString(values?.memo || '')) : noneCV()
        );
      }

      const options = {
        txData: {
          txType: TransactionTypes.ContractCall,
          contractAddress,
          contractName,
          functionName,
          functionArgs: functionArgs.map(serializeCV).map(arg => arg.toString('hex')),
          postConditions,
          postConditionMode: PostConditionMode.Deny,
          network,
          publicKey: account.stxPublicKey,
        },
        fee: stxToMicroStx(values?.fee || 0).toNumber(),
        publicKey: account.stxPublicKey,
        nonce: Number(values?.nonce) ?? nonce,
      } as const;

      return generateUnsignedTransaction(options);
    },
    [address, assetTransferState, selectedAsset, account, nonce]
  );
}

export function useFtTokenTransferUnsignedTx(values?: TransactionFormValues) {
  const generateTx = useGenerateFtTokenTransferUnsignedTx();
  const address = useAtomValue(currentAccountStxAddressState);
  const account = useAtomValue(currentAccountState);
  const assetTransferState = useMakeFungibleTokenTransfer();
  const selectedAsset = useSelectedAssetItem();

  return useAsync(
    async () => generateTx(values ?? undefined),
    [values, address, account, assetTransferState, selectedAsset]
  ).result;
}
