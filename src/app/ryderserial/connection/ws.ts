import { Options } from '../ryder-serial';

export class WSConnection {
  private open: boolean;
  private socket: WebSocket;
  constructor(path: string, options?: Options) {
    this.open = false;
    this.socket = new WebSocket(path);
  }

  isOpen(): boolean {
    return this.open;
  }

  write(
    data: Buffer,
    callback?: (error: Error | null | undefined, bytesWritten: number) => void
  ): boolean {
    this.socket.send(data);
    return true;
  }

  on(event: string, callback: (data?: any) => void): this {
    switch (event) {
      case 'data':
        this.socket.onmessage = messageEvent => {
          console.log(messageEvent.data);
          messageEvent.data.arrayBuffer().then((d: Uint8Array) => callback(d));
        };
        break;
      case 'error':
        this.socket.onerror = errorEvent => {
          callback(errorEvent);
        };
        break;
      case 'close':
        this.socket.onclose = closeEvent => {
          this.open = false;
          callback();
        };
        break;
      case 'open':
        this.socket.onopen = () => {
          this.open = true;
          callback();
        };
        break;

      default:
        console.log('unsupported event ', event);
    }

    return this;
  }

  close(): void {
    this.socket.close();
  }
}
