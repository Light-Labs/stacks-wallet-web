/* eslint-disable no-console */
import { hexToBytes } from '@stacks/common';
import {
  AddressVersion,
  ClarityValue,
  TupleCV,
  compressPublicKey,
  createStacksPublicKey,
  cvToHex,
  deserializeTransaction,
  getAddressFromPublicKey,
  hexToCV,
  publicKeyToAddress,
} from '@stacks/transactions';
import {
  LedgerError,
  ResponseAddress,
  ResponseAppInfo,
  ResponseVersion,
} from '@zondax/ledger-stacks';
import { reject } from 'lodash';

import RyderSerial, { Options } from '../../ryderserial';
import { pathToBytes } from './ryder-bip-utils';

interface RyderAppError {
  source: Error;
  error: string;
}
interface Success<T> {
  data: T;
}
export type Response<T> = RyderAppError | Success<T>;

const port = 'ws:/localhost:8888';
const stxDerivationWithoutAccount = `m/44'/5757'/0'/0/`;
const identityDerivationWithoutAccount = `m/888'/0'/`;
export class StacksApp {
  constructor(_: any) {}
  signGetChunks(path: string, message: Buffer): Promise<Buffer[]> {
    return Promise.reject('signGetChunks not implemented');
  }
  getVersion(): Promise<ResponseVersion> {
    return new Promise<ResponseVersion>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.serial_info({ port, options: { debug: true } }, (res: any) => {
        if (typeof res === typeof 'a string') {
          reject(res);
        } else {
          resolve(res.data);
        }
      });
    });
  }

  setupDevice(): Promise<Boolean> {
    return new Promise<Boolean>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.setup_device({ port, options: { debug: true } }, (res: Response<boolean>) => {
        resolve((res as any).data);
      });
    });
  }
  getAppInfo(): Promise<ResponseAppInfo> {
    return Promise.reject('getAppInfo not implemented');
  }
  getAddressAndPubKey(path: string, version: AddressVersion): Promise<ResponseAddress> {
    console.log('try export ', path);
    return new Promise<ResponseAddress>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .export_derived_public_key({ port, options: { debug: true } }, path, (res: any) => {
          const publicKey = Buffer.from(res.data.substring(0, 66), 'hex');
          console.log('response', res, publicKey);
          const address = getAddressFromPublicKey(publicKey);
          console.log({ address });
          resolve({
            publicKey,
            address,
            errorMessage: '',
            returnCode: LedgerError.NoErrors,
          });
        })
        .then(() => {
          console.log('getAddressAndPubKey request sent');
        });
    });
  }

  async getIdentityPubKey(path: string): Promise<ResponseAddress> {
    console.log({ path });
    const index = parseInt(path.replace(identityDerivationWithoutAccount, '').slice(0, -1));
    console.log('try export ', index);
    return new Promise<ResponseAddress>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .serial_export_identity({ port, options: { debug: true } }, index, (res: any) => {
          const publicKey = Buffer.from(res.data.substring(0, 66), 'hex');
          console.warn('response identity', res);
          const address = getAddressFromPublicKey(publicKey);
          console.warn({ address });
          resolve({
            publicKey,
            address,
            errorMessage: '',
            returnCode: LedgerError.NoErrors,
          });
        })
        .then(() => {
          console.log('getIdentityPubKey request sent');
        });
    });
  }

  showAddressAndPubKey(path: string, version: AddressVersion): Promise<ResponseAddress> {
    return Promise.reject('showAddressAndPubKey not implemented');
  }
  signSendChunk(chunkIdx: number, chunkNum: number, chunk: Buffer): Promise<ResponseSign> {
    return Promise.reject('signSendChunk not implemented');
  }
  async sign(path: string, message: Buffer): Promise<any> {
    console.log({ path });
    const index = parseInt(path.replace(stxDerivationWithoutAccount, ''));
    console.log('sign tx with account ', index);
    console.log(message);
    try {
      console.log('tx', deserializeTransaction(message));
    } catch (e) {
      console.log(e);
    }
    console.log('tx sign now');
    return new Promise<any>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.sign_transaction(
        { port, options: { debug: true } },
        index,
        Buffer.from(message),
        (res: any) => {
          console.log('response', res);
          resolve({ data: res.data, returnCode: LedgerError.NoErrors });
        }
      );
    });
  }
  async sign_structured_msg(path: string, domain: string, payload: string): Promise<any> {
    const index = parseInt(path.replace(stxDerivationWithoutAccount, ''));
    console.log('sign msg with account ', index, ', Index derived from', path, domain, payload);
    console.log(domain, payload);
    return new Promise<any>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.sign_structed_message(
        { port, options: { debug: true } },
        index,
        hexToCV(domain) as TupleCV, // TODO verify
        hexToCV(payload), // TODO verify
        (res: any) => {
          console.warn('response', res);
          resolve({ signatureDER: res.data });
        }
      );
    });
  }

  async sign_jwt(path: string, message: string): Promise<any> {
    const index = parseInt(path.replace(identityDerivationWithoutAccount, '').slice(0, -1));
    console.log('sign jwt hash with account ', index, ', Index derived from', path);
    console.log(message);
    return new Promise<any>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.sign_identity_message(
        { port, options: { debug: true } },
        index,
        Buffer.from(message),
        (res: any) => {
          console.warn('response', res);
          resolve({ signatureDER: res.data });
        }
      );
    });
  }

  async exportAppPrivateKey(index: number, appDomain: string) {
    console.log('try export app private key ', index, appDomain);
    // TODO check max length of app domain
    return new Promise<{ appPrivateKey: string }>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .serial_app_sign_in_legacy(
          { port, options: { debug: true } },
          index,
          appDomain,
          (res: any) => {
            console.log('response', res);
            resolve(res);
          }
        )
        .then(() => {
          console.log('exportAppPrivateKey request sent');
        });
    });
  }
}
class RyderApp {
  ryder_serial?: RyderSerial;

  async setup_device(
    payload: { port: string; options?: Options },
    callback: (res: Response<boolean>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<boolean>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });
      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        console.log('setup device');
        await this.ryder_serial.send(RyderSerial.COMMAND_SETUP);
        resolve(true);
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        console.log('Unexpected wait_user_confirm');
        return;
      });
    })
      .then((res: boolean) => wrapped_callback({ data: res }))
      .catch(error =>
        wrapped_callback({
          source: error,
          error: error,
        })
      );
  }

  async serial_info(
    payload: { port: string; options?: Options },
    callback: (res: Response<ResponseVersion | string>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<ResponseVersion | string>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });
      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        console.log('send info start');
        const response = await this.ryder_serial.send(RyderSerial.COMMAND_INFO);
        console.log('send info end');
        const info = typeof response === 'number' ? response.toString() : response;
        if (!info || info.substring(0, 5) !== 'ryder') {
          reject(`Device at ${payload.port} does not appear to be a Ryder device`);
          return;
        } else {
          resolve({
            targetId: 'ryder',
            major: info.charCodeAt(5),
            minor: info.charCodeAt(6),
            patch: info.charCodeAt(7),
            testMode: true,
            deviceLocked: false,
            errorMessage: '',
            returnCode: LedgerError.NoErrors,
          });
          return;
        }
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        console.log('Unexpected wait_user_confirm');
        return;
      });
    })
      .then((res: string | ResponseVersion) => wrapped_callback({ data: res }))
      .catch(error =>
        wrapped_callback({
          source: error,
          error: error,
        })
      );
  }

  async export_derived_public_key(
    payload: { port: string; options?: Options },
    path: string,
    callback: (res: Response<string>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<string>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });

      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        let response = await this.ryder_serial.send([
          RyderSerial.COMMAND_EXPORT_DERIVED_PUBLIC_KEY,
        ]);

        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        let sendInput =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response, 'binary').toString('hex');
        console.log({ sendInput });
        response = await this.ryder_serial.send(pathToBytes(path));

        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response, response);
        const publicKey =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response.substring(1), 'binary').toString('hex');
        // eslint-disable-next-line no-console
        console.log(publicKey);
        console.log(
          publicKey,
          publicKeyToAddress(AddressVersion.MainnetSingleSig, compressPublicKey(publicKey)),
          publicKeyToAddress(AddressVersion.MainnetSingleSig, createStacksPublicKey(publicKey))
        );
        resolve(publicKey);
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        console.log('Confirm or cancel on Ryder device.');
        return;
      });
    })
      .then((res: string) => wrapped_callback({ data: res }))
      .catch(error =>
        wrapped_callback({
          source: error,
          error: error,
        })
      );
  }

  async serial_export_identity(
    payload: { port: string; options?: Options },
    index: number,
    callback: (res: Response<string>) => void
  ): Promise<void> {
    this.export_derived_public_key(payload, `m/888'/0'/${index}'`, callback);
  }

  async assert_send_input(response: string | number) {
    const sendInput = typeof response === 'number' ? response : 0;
    return sendInput === RyderSerial.RESPONSE_SEND_INPUT;
  }

  async serial_app_sign_in_legacy(
    payload: { port: string; options?: Options },
    accountIndex: number,
    appDomain: string,
    callback: (
      res: Response<{
        walletPubKey: Uint8Array;
        identityPubKey: Uint8Array;
        appPrivateKey: Uint8Array;
      }>
    ) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<{
      walletPubKey: Uint8Array;
      identityPubKey: Uint8Array;
      appPrivateKey: Uint8Array;
    }>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });

      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        let response = await this.ryder_serial.send([
          RyderSerial.COMMAND_STACKS_APP_SIGN_IN_REQUEST_LEGACY,
        ]);

        if (!this.assert_send_input(response)) {
          console.log('app domain not requested by ryder, expected send_input, abort ');
          return;
        }

        const length = appDomain.length;
        console.log('sending app domain', appDomain);

        const data = new Uint8Array(2 + 1 + length);
        data.set(new Uint8Array(new Uint16Array([accountIndex]).buffer).reverse(), 0);
        data.set(new Uint8Array([length]), 2);
        data.set(Buffer.from(appDomain), 3);
        console.log('data', data);
        response = await this.ryder_serial.send(data);

        console.log('typeof response', typeof response);
        if (typeof response === 'number') {
          console.log('error', response);
          return;
        }
        response = response.substring(2);

        const walletPubKey = Buffer.from(response.substring(0, 33), 'binary').toString('hex');
        const identityPubKey = Buffer.from(response.substring(34, 66), 'binary').toString('hex');
        const appPrivateKey = Buffer.from(response.substring(67), 'binary').toString('hex');
        // eslint-disable-next-line no-console
        console.log({ walletPubKey, identityPubKey, appPrivateKey });

        resolve({
          walletPubKey: new Uint8Array(Buffer.from(response, 'binary')),
          identityPubKey: new Uint8Array(Buffer.from(response, 'binary')),
          appPrivateKey: new Uint8Array(Buffer.from(response, 'binary')),
        });

        return;
      });

      this.ryder_serial.on('wait_user_confirm', () => {
        resolve({
          walletPubKey: new Uint8Array(),
          identityPubKey: new Uint8Array(),
          appPrivateKey: new Uint8Array(),
        });
        return;
      });
    })
      .then(
        (res: {
          walletPubKey: Uint8Array;
          identityPubKey: Uint8Array;
          appPrivateKey: Uint8Array;
        }) => wrapped_callback({ data: res })
      )
      .catch(error => {
        console.log({ error });
        wrapped_callback({
          source: error,
          error: error,
        });
      });
  }

  async sign_identity_message(
    payload: { port: string; options?: Options },
    accountIndex: number,
    message: Buffer,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<Uint8Array>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });

      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        let response = await this.ryder_serial.send([
          RyderSerial.COMMAND_REQUEST_IDENTITY_MESSAGE_SIGN,
        ]);
        // expected response: RESPONSE_SEND_INPUT
        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        if (response === RyderSerial.RESPONSE_SEND_INPUT) {
          // eslint-disable-next-line no-console
          const length = message.length;
          console.log('sending message to sign', accountIndex, length);
          const data = new Uint8Array(2 + 4 + length);
          data.set(new Uint8Array(new Uint16Array([accountIndex]).buffer).reverse(), 0);
          data.set(new Uint8Array(new Uint32Array([length]).buffer).reverse(), 2);
          data.set(message, 6);
          response = await this.ryder_serial.send(data);
          const signature =
            typeof response === 'number'
              ? response.toString()
              : Buffer.from(response.slice(1), 'binary').toString('hex'); // FIXME after fixing https://github.com/Light-Labs/stacks-wallet-web/issues/9
          // eslint-disable-next-line no-console
          console.log({ signature });
          resolve(
            typeof response === 'number'
              ? new Uint8Array([response])
              : new Uint8Array(Buffer.from(response.slice(1), 'binary')) // FIXME after fixing https://github.com/Light-Labs/stacks-wallet-web/issues/9
          );
        }
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        console.log('wait_user_confirm');
        // just wait
        return;
      });
    })
      .then((res: Uint8Array) => wrapped_callback({ data: res }))
      .catch(error =>
        wrapped_callback({
          source: error,
          error: error,
        })
      );
  }

  async sign_transaction(
    payload: { port: string; options?: Options },
    accountIndex: number,
    message: Buffer,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<Uint8Array>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });

      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        let response = await this.ryder_serial.send([RyderSerial.COMMAND_REQUEST_TRANSACTION_SIGN]);
        if (response !== RyderSerial.RESPONSE_SEND_INPUT) {
          // TODO handle errors
          console.log('error from ryder device', response);
          return;
        }

        const messageLength = message.byteLength;
        const data = new Uint8Array(2 + 4 + messageLength);
        data.set(new Uint8Array(new Uint16Array([accountIndex]).buffer).reverse(), 0);
        data.set(new Uint8Array(new Uint32Array([messageLength]).buffer).reverse(), 2);
        data.set(new Uint8Array(message), 6);

        console.log('data to send', Buffer.from(data.buffer).toString('hex'));
        response = await this.ryder_serial.send(data);
        const signedTx =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response, 'binary').toString('hex');
        console.log(deserializeTransaction(signedTx));
        // eslint-disable-next-line no-console
        resolve(
          typeof response === 'number'
            ? new Uint8Array([response])
            : new Uint8Array(Buffer.from(response, 'binary'))
        );

        return;
      });

      this.ryder_serial.on('wait_user_confirm', () => {
        // do nothing until confirmed by user
        return;
      });
    })
      .then((res: Uint8Array) => {
        console.log({ res });
        //wrapped_callback({ data: res })
      })
      .catch(error => {
        console.log('tx-sign', error);
        wrapped_callback({
          source: error,
          error: error,
        });
      });
  }

  async sign_structed_message(
    serialSettings: { port: string; options?: Options },
    accountIndex: number,
    domain: TupleCV,
    payload: ClarityValue,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(serialSettings.port, serialSettings.options);
    let wrapped_callback = (res) => {
      // The `RyderSerial` must be closed before invoking the callback, or the latter might create a
      // new `RyderSerial` and get a device busy error
      this.ryder_serial?.close();
      callback(res);
    };
    new Promise<Uint8Array>((resolve, reject) => {
      if (!this.ryder_serial) {
        reject('Ryder Serial does not exist for some reason');
        return;
      }

      this.ryder_serial.on('failed', (error: Error) => {
        reject(
          `Could not connect to the Ryder on the specified port. Wrong port or it is currently in use: ${error}`
        );
        return;
      });

      this.ryder_serial.on('open', async () => {
        if (!this.ryder_serial) {
          reject('Ryder serial was destroyed');
          return;
        }
        let response = await this.ryder_serial.send([
          RyderSerial.COMMAND_REQUEST_STRUCTURED_MESSAGE_SIGN,
        ]);
        // expected response: RESPONSE_SEND_INPUT
        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        if (response === RyderSerial.RESPONSE_SEND_INPUT) {
          const domainBytes = hexToBytes(cvToHex(domain).substring(2));
          const payloadBytes = hexToBytes(cvToHex(payload).substring(2));
          const length = domainBytes.length + payloadBytes.length;
          console.log('sending message to sign', accountIndex, length);
          const data = new Uint8Array(2 + 4 + length);
          data.set(new Uint8Array(new Uint16Array([accountIndex]).buffer).reverse(), 0);
          data.set(new Uint8Array(new Uint32Array([length]).buffer).reverse(), 2);
          data.set(domainBytes, 6);
          data.set(payloadBytes, 6 + domainBytes.length);
          response = await this.ryder_serial.send(data);
          const signature =
            typeof response === 'number'
              ? response.toString()
              : Buffer.from(response.slice(1), 'binary').toString('hex'); // FIXME after fixing https://github.com/Light-Labs/stacks-wallet-web/issues/9
          // eslint-disable-next-line no-console
          console.log({ signature });
          resolve(
            typeof response === 'number'
              ? new Uint8Array([response])
              : new Uint8Array(Buffer.from(response.slice(1), 'binary')) // FIXME after fixing https://github.com/Light-Labs/stacks-wallet-web/issues/9
          );
        }
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        console.log('wait_user_confirm');
        // just wait
        return;
      });
    })
      .then((res: Uint8Array) => wrapped_callback({ data: res }))
      .catch(error =>
        wrapped_callback({
          source: error,
          error: error,
        })
      );
  }
}
