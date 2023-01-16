/*
 * A WebSocket connection that provides hooks for various events from the connection.
 */
export class WSConnection {
  private open: boolean;
  private socket: WebSocket;

  /*
   * Opens a WebSocket connection.
   *
   * @param url The url of the listening server.
   */
  constructor(url: string) {
    this.open = false;
    this.socket = new WebSocket(url);
  }

  /*
   * Returns whether the connection is open.
   */
  isOpen(): boolean {
    return this.open;
  }

  /*
   * Sends data through the connection.
   */
  write(data: Buffer) {
    this.socket.send(data);

    if (!this.open) {
      console.log('WSConnection.write called on a closed connection');
    }
  }

  /*
   * Registers a callback to be called when a connection event occurs.
   *
   * @param event The kind of event to register the callback to. Can be one of `data`, `error`,
   * `close`, or `open`.
   * @param callback The function to call when the specified event occurs. If `event` is "data", the
   * argument will be the data received on the connection. If `event` is "error", the argument will
   * be the error received. Otherwise, it will be undefined.
   */
  on(event: string, callback: (data?: any) => void): this {
    switch (event) {
      case 'data':
        this.socket.onmessage = messageEvent => {
          callback(messageEvent.data);
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

  /*
   * Closes the connection.
   */
  close(): void {
    this.socket.close();
  }
}
