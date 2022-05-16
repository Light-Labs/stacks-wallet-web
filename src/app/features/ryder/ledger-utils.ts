/* eslint-disable no-console */
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import Transport from '@ledgerhq/hw-transport-webusb';
import StacksApp, { LedgerError, ResponseVersion } from '@zondax/ledger-blockstack';

import {
  AddressVersion,
  createMessageSignature,
  deserializeTransaction,
  SingleSigSpendingCondition,
} from '@stacks/transactions';
import { keySlice } from '@app/store/keys/key.slice';
import { RouteUrls } from '@shared/route-urls';

import { io, Socket } from 'socket.io-client';

import { delay } from '@app/common/utils';
import { sendMessage } from '@shared/messages';
import { InternalMethods } from '@shared/message-types';
import { safeAwait } from '@stacks/ui';
import { useState } from 'react';
import { LedgerTxSigningProvider } from './ledger-tx-signing.context';
import { RyderApp } from './ryder-utils';

const stxDerivationWithAccount = `m/44'/5757'/0'/0/{account}`;

export async function connectRyder() {
  const transport = await Transport.create();
  return new StacksApp(transport);
}

function requestPublicKeyForAccount(app: StacksApp) {
  return async (index: number) =>
    app.getAddressAndPubKey(
      stxDerivationWithAccount.replace('{account}', index.toString()),
      // We pass mainnet as it expects something, however this is so it can return a formatted address
      // We only need the public key, and can derive the address later in any network format
      AddressVersion.MainnetSingleSig
    );
}

export async function getAppVersion(app: StacksApp) {
  return app.getVersion();
}

const port = 'ws:/localhost:8080';

export function extractDeviceNameFromKnownTargetIds(targetId: string) {
  return "Ryder"
}

export function signLedgerTransaction() {
  return async (payload: Buffer, accountIndex: number) => {
    return new Promise<{ info: string }>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .serial_info({ port, options: { debug: true } }, (res: any) => {
          console.log('response', res);
          resolve({ info: res.data });
        })
        .then(() => {
          console.log('request sent');
        });
    });
  };
}

export function signTransactionWithSignature(transaction: string, signatureVRS: Buffer) {
  const deserialzedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserialzedTx.auth.spendingCondition as SingleSigSpendingCondition).signature =
    spendingCondition;
  return deserialzedTx;
}

interface PullKeysFromLedgerSuccess {
  status: 'success';
  publicKeys: string[];
}

interface PullKeysFromLedgerFailure {
  status: 'failure';
  errorMessage: string;
  returnCode: number;
}

type PullKeysFromLedgerResponse = Promise<PullKeysFromLedgerSuccess | PullKeysFromLedgerFailure>;

export async function pullKeysFromLedgerDevice(): PullKeysFromLedgerResponse {
  const publicKeys: any[] = [];
  const amountOfKeysToExtractFromDevice = 2;
  for (let index = 0; index < amountOfKeysToExtractFromDevice; index++) {
    try {
      const resp = await exportPublicKey(index);
      console.log({ resp });
      toast.success(`Fetched Account ${index + 1}`, { duration: 1000 });
      if (!resp.publicKey) return { status: 'failure', errorMessage: 'failure', returnCode: 100 };
      publicKeys.push(resp.publicKey);
    } catch (e) {
      console.log(e);
    }
  }
  await delay(1000);
  return { status: 'success', publicKeys };
}

async function exportPublicKey(index: number) {
  console.log('try export ', index);
  return new Promise<{ publicKey: string }>(resolve => {
    const ryderApp = new RyderApp();
    void ryderApp
      .serial_export_identity({ port, options: { debug: true } }, index, (res: any) => {
        console.log('response', res);
        resolve({ publicKey: res.data });
      })
      .then(() => {
        console.log('request sent');
      });
  });
}

export function useLedgerResponseState() {
  return useState<LedgerTxSigningProvider['latestDeviceResponse']>(null);
}

export function isStacksLedgerAppClosed(response: ResponseVersion) {
  const anotherUnknownErrorCodeMeaningAppClosed = 28161;
  return (
    response.returnCode === LedgerError.AppDoesNotSeemToBeOpen ||
    response.returnCode === anotherUnknownErrorCodeMeaningAppClosed
  );
}
