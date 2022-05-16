/* eslint-disable no-console */
import { useState } from 'react';
import Transport from '@ledgerhq/hw-transport-webusb';
import StacksApp, { LedgerError, ResponseVersion } from '@zondax/ledger-blockstack';
import * as ecdsaFormat from 'ecdsa-sig-formatter';

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
import { sha256 } from 'sha.js';
import { RyderApp } from './ryder-utils';

const stxDerivationWithAccount = `m/44'/5757'/0'/0/{account}`;

const identityDerivationWithAccount = `m/888'/0'/0'/{account}`;

export async function connectLedger() {
  const transport = await Transport.create();
  return new StacksApp(transport);
}

function requestPublicKeyForStxAccount(app: StacksApp) {
  return async (index: number) =>
    app.getAddressAndPubKey(
      stxDerivationWithAccount.replace('{account}', index.toString()),
      // We pass mainnet as it expects something, however this is so it can return a formatted address
      // We only need the public key, and can derive the address later in any network format
      AddressVersion.MainnetSingleSig
    );
}

function requestPublicKeyForIdentityAccount(app: StacksApp) {
  return async (index: number) =>
    app.getIdentityPubKey(identityDerivationWithAccount.replace('{account}', index.toString()));
}

export async function getAppVersion(app: StacksApp) {
  return app.getVersion();
}

const port = 'ws:/localhost:8080';

export function extractDeviceNameFromKnownTargetIds(targetId: string) {
  return "Ryder"
}

interface PrepareLedgerDeviceConnectionArgs {
  setLoadingState(loadingState: boolean): void;
  onError(): void;
}
export async function prepareLedgerDeviceConnection(args: PrepareLedgerDeviceConnectionArgs) {
  const { setLoadingState, onError } = args;
  setLoadingState(true);
  const [error, stacks] = await safeAwait(connectLedger());
  await delay(1000);
  setLoadingState(false);

  if (error) {
    onError();
    return;
  }

  return stacks;
}

export function signLedgerTransaction(app: StacksApp) {
  return async (payload: Buffer, accountIndex: number) =>
    app.sign(stxDerivationWithAccount.replace('{account}', accountIndex.toString()), payload);
}

export function signLedgerJwtHash(app: StacksApp) {
  return async (payload: string, accountIndex: number) =>
    app.sign_jwt(
      identityDerivationWithAccount.replace('{account}', accountIndex.toString()),
      payload
    );
}

export function signTransactionWithSignature(transaction: string, signatureVRS: Buffer) {
  const deserialzedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserialzedTx.auth.spendingCondition as SingleSigSpendingCondition).signature =
    spendingCondition;
  return deserialzedTx;
}

export interface StxAndIdentityPublicKeys {
  stxPublicKey: string;
  dataPublicKey: string;
}

interface PullKeysFromLedgerSuccess {
  status: 'success';
  publicKeys: StxAndIdentityPublicKeys[];
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

function reformatDerSignatureToJose(derSignature: Uint8Array) {
  return ecdsaFormat.derToJose(Buffer.from(derSignature), 'ES256');
}

export function addSignatureToAuthResponseJwt(authResponse: string, signature: Uint8Array) {
  const resultingSig = reformatDerSignatureToJose(signature);
  return [authResponse, resultingSig].join('.');
}

export function getSha256HashOfJwtAuthPayload(payload: string) {
  return new sha256().update(payload).digest('hex');
}
