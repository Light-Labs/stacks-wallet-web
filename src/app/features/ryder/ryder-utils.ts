/* eslint-disable no-console */
import {
  AddressVersion,
  deserializeTransaction,
  getAddressFromPublicKey,
} from '@stacks/transactions';
import {
  LedgerError,
  ResponseAddress,
  ResponseAppInfo,
  ResponseVersion,
} from '@zondax/ledger-blockstack';
import { reject } from 'lodash';
import { deserialize } from 'v8';
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

const port = 'ws:/localhost:8080';
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
          console.log('request sent');
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
          console.log('response', res);
          const address = getAddressFromPublicKey(res.data);
          console.log({ address });
          resolve({
            publicKey: res.data,
            address,
            errorMessage: '',
            returnCode: LedgerError.NoErrors,
          });
        })
        .then(() => {
          console.log('request sent');
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
  async sign_msg(path: string, message: string): Promise<any> {
    return Promise.reject('sign_msg not implemented');
  }

  async sign_jwt(path: string, message: string): Promise<any> {
    console.log({ path });
    const index = parseInt(path.replace(identityDerivationWithoutAccount, '').slice(0, -1));
    console.log('sign jwt hash with account ', index);
    console.log(message);
    return new Promise<any>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp.sign_identity_message(
        { port, options: { debug: true } },
        index,
        Buffer.from(message),
        (res: any) => {
          console.log('response', res);
          resolve({ signatureDER: res.data });
        }
      );
    });
  }

  async exportPublicKey(index: number) {
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

  async exportAppPrivateKey(index: number, appDomain: string) {
    console.log('try export app private key ', index, appDomain);
    // TODO check max length of app domain
    return new Promise<{ appPrivateKey: string }>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .serial_export_app_private_key(
          { port, options: { debug: true } },
          index,
          appDomain,
          (res: any) => {
            console.log('response', res);
            resolve({ appPrivateKey: res.data });
          }
        )
        .then(() => {
          console.log('request sent');
        });
    });
  }
}
class RyderApp {
  ryder_serial?: RyderSerial;

  async serial_info(
    payload: { port: string; options?: Options },
    callback: (res: Response<ResponseVersion | string>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
        resolve('Confirm or cancel on Ryder device.');
        return;
      });
    })
      .then((res: string | ResponseVersion) => callback({ data: res }))
      .catch(error =>
        callback({
          source: error,
          error: error,
        })
      )
      .finally(() => this.ryder_serial?.close());
  }

  async export_derived_public_key(
    payload: { port: string; options?: Options },
    path: string,
    callback: (res: Response<string>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
        const response = await this.ryder_serial.send(
          [RyderSerial.COMMAND_EXPORT_DERIVED_PUBLIC_KEY].concat(pathToBytes(path))
        );

        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        const publicKey =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response, 'binary').toString('hex');
        // eslint-disable-next-line no-console
        console.log(
          publicKey
          //publicKeyToAddress(AddressVersion.MainnetSingleSig, createStacksPublicKey(publicKey))
        );
        resolve(publicKey);
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        resolve('Confirm or cancel on Ryder device.');
        return;
      });
    })
      .then((res: string) => callback({ data: res }))
      .catch(error =>
        callback({
          source: error,
          error: error,
        })
      )
      .finally(() => this.ryder_serial?.close());
  }

  async serial_export_identity(
    payload: { port: string; options?: Options },
    index: number,
    callback: (res: Response<string>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
        const response = await this.ryder_serial.send([
          RyderSerial.COMMAND_EXPORT_PUBLIC_IDENTITY,
          index,
        ]);
        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        const publicKey =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response, 'binary').toString('hex');
        // eslint-disable-next-line no-console
        console.log(
          publicKey
          //publicKeyToAddress(AddressVersion.MainnetSingleSig, createStacksPublicKey(publicKey))
        );
        resolve(publicKey);
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        resolve('Confirm or cancel on Ryder device.');
        return;
      });
    })
      .then((res: string) => callback({ data: res }))
      .catch(error =>
        callback({
          source: error,
          error: error,
        })
      )
      .finally(() => this.ryder_serial?.close());
  }

  async serial_export_app_private_key(
    payload: { port: string; options?: Options },
    accountIndex: number,
    appDomain: string,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
          RyderSerial.COMMAND_EXPORT_APP_KEY_PRIVATE_KEY,
          accountIndex,
        ]);
        // eslint-disable-next-line no-console
        console.log('typeof response', typeof response);
        const sendInput = typeof response === 'number' ? response : 0;
        if (sendInput === RyderSerial.RESPONSE_SEND_INPUT) {
          const length = appDomain.length;
          console.log('sending app domain');
          const data = new Uint8Array(length + 1);
          data.set(Buffer.from(appDomain), 0);
          data.set([0], length);
          response = await this.ryder_serial.send(data);

          console.log('typeof response', typeof response);

          const appPRivateKey =
            typeof response === 'number'
              ? response.toString()
              : Buffer.from(response, 'binary').toString('hex');
          // eslint-disable-next-line no-console
          console.log({ appPRivateKey });

          resolve(
            typeof response === 'number'
              ? new Uint8Array([response])
              : new Uint8Array(Buffer.from(response, 'binary'))
          );
        }

        return;
      });

      this.ryder_serial.on('wait_user_confirm', () => {
        resolve(new Uint8Array());
        return;
      });
    })
      .then((res: Uint8Array) => callback({ data: res }))
      .catch(error =>
        callback({
          source: error,
          error: error,
        })
      )
      .finally(() => this.ryder_serial?.close());
  }

  async sign_identity_message(
    payload: { port: string; options?: Options },
    accountIndex: number,
    message: Buffer,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
              : Buffer.from(response, 'binary').toString('hex');
          // eslint-disable-next-line no-console
          console.log({ signature });
          resolve(
            typeof response === 'number'
              ? new Uint8Array([response])
              : new Uint8Array(Buffer.from(response, 'binary'))
          );
        }
        return;
      });
      this.ryder_serial.on('wait_user_confirm', () => {
        resolve(new Uint8Array());
        return;
      });
    })
      .then((res: Uint8Array) => callback({ data: res }))
      .catch(error =>
        callback({
          source: error,
          error: error,
        })
      )
      .finally(() => this.ryder_serial?.close());
  }

  async sign_transaction(
    payload: { port: string; options?: Options },
    accountIndex: number,
    message: Buffer,
    callback: (res: Response<Uint8Array>) => void
  ): Promise<void> {
    this.ryder_serial = new RyderSerial(payload.port, payload.options);
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
          RyderSerial.COMMAND_REQUEST_TRANSACTION_SIGN,
          accountIndex,
        ]);
        if (response !== RyderSerial.RESPONSE_SEND_INPUT) {
          // TODO handle errors
          console.log('error from ryder device', response);
          return;
        }
        /*
        const data = new Uint8Array(4 + length);
        data.set(new Uint8Array(new Uint32Array([length]).buffer).reverse(), 0);
        data.set(message, 4);
*/
        const tx_length = Buffer.from([
          (message.byteLength >> 24) & 0xff,
          (message.byteLength >> 16) & 0xff,
          (message.byteLength >> 8) & 0xff,
          message.byteLength & 0xff,
        ]);
        const data = Buffer.concat([tx_length, message]);
        const uint8a = new Uint8Array(data.byteLength);
        for (let i = 0; i < data.byteLength; ++i) uint8a[i] = data[i];

        console.log(Buffer.from(uint8a).toString('hex'));
        response = await this.ryder_serial.send(uint8a);
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
        resolve(new Uint8Array());
        return;
      });
    })
      .then((res: Uint8Array) => callback({ data: res }))
      .catch(error => {
        console.log('tx-sign', error);
        callback({
          source: error,
          error: error,
        });
      })
      .finally(() => this.ryder_serial?.close());
  }
}
