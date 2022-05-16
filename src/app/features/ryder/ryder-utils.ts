/* eslint-disable no-console */
import { AddressVersion, createStacksPublicKey, getAddressFromPublicKey, publicKeyToAddress } from '@stacks/transactions';
import { ResponseAddress, ResponseAppInfo, ResponseVersion } from '@zondax/ledger-blockstack';
import RyderSerial, { Options } from '../../ryderserial';

interface RyderAppError {
  source: Error;
  error: string;
}
interface Success<T> {
  data: T;
}
export type Response<T> = RyderAppError | Success<T>;

const port = 'ws:/localhost:8080';
const stxDerivationWithAccount = `m/44'/5757'/0'/0/{account}`;
const identityDerivationWithoutAccount = `m/888'/0'/0'/`;

export class StacksApp {
  constructor(_: any) {}
  signGetChunks(path: string, message: Buffer): Promise<Buffer[]> {
    return Promise.reject('Not implemented');
  }
  getVersion(): Promise<ResponseVersion> {
    return Promise.reject('Not implemented');
  }
  getAppInfo(): Promise<ResponseAppInfo> {
    return Promise.reject('Not implemented');
  }
  getAddressAndPubKey(path: string, version: AddressVersion): Promise<ResponseAddress> {
    return Promise.reject('Not implemented');
  }
  async getIdentityPubKey(path: string): Promise<ResponseAddress> {
    const index = parseInt(path.replace(identityDerivationWithoutAccount, ""));
    console.log('try export ', index);
    return new Promise<ResponseAddress>(resolve => {
      const ryderApp = new RyderApp();
      void ryderApp
        .serial_export_identity({ port, options: { debug: true } }, index, (res: any) => {
          console.log('response', res);
          const address = getAddressFromPublicKey(res.data);
          resolve({ publicKey: res.data, address, errorMessage: '', returnCode: 0 });
        })
        .then(() => {
          console.log('request sent');
        });
    });
  }
  showAddressAndPubKey(path: string, version: AddressVersion): Promise<ResponseAddress> {
    return Promise.reject('Not implemented');
  }
  signSendChunk(chunkIdx: number, chunkNum: number, chunk: Buffer): Promise<ResponseSign> {
    return Promise.reject('Not implemented');
  }
  async sign(path: string, message: Buffer): Promise<any> {
    return Promise.reject('Not implemented');
  }
  async sign_msg(path: string, message: string): Promise<any> {
    return Promise.reject('Not implemented');
  }
  async sign_jwt(path: string, message: string): Promise<any> {
    return Promise.reject('Not implemented');
  }
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

class RyderApp {
  ryder_serial?: RyderSerial;

  async serial_info(
    payload: { port: string; options?: Options },
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

        const response = await this.ryder_serial.send(RyderSerial.COMMAND_INFO);
        const info = typeof response === 'number' ? response.toString() : response;
        if (!info || info.substring(0, 5) !== 'ryder') {
          reject(`Device at ${payload.port} does not appear to be a Ryder device`);
        } else {
          resolve(info);
        }
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
          publicKeyToAddress(AddressVersion.MainnetSingleSig, createStacksPublicKey(publicKey))
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
}
