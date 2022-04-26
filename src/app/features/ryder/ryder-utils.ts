import RyderSerial, { Options } from '@lightlabs/ryderserial-proto';

interface RyderAppError {
  source: Error;
  error: string;
}
interface Success<T> {
  data: T;
}
export type Response<T> = RyderAppError | Success<T>;

export class RyderApp {
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
        const publicKey =
          typeof response === 'number'
            ? response.toString()
            : Buffer.from(response, 'binary').toString('hex');

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
