import Events from 'events'; // https://nodejs.org/api/events.html#events_class_eventemitter
import { LogLevel, Logger, make_logger, log_security_level } from '../logging';
import Train, { Entry } from './sequencer';
import { WSConnection } from '../connection/ws';

// responses
const RESPONSE_OK = 1; // generic command ok/received
const RESPONSE_SEND_INPUT = 2; // command received, send input
const RESPONSE_REJECTED = 3; // user input rejected
const RESPONSE_OUTPUT = 4; // sending output
const RESPONSE_OUTPUT_END = 5; // end of output
const RESPONSE_ESC_SEQUENCE = 6; // output esc sequence
const RESPONSE_WAIT_USER_CONFIRM = 10; // user has to confirm action
const RESPONSE_LOCKED = 11; // device is locked, send PIN

// error responses
const response_errors: Record<number, string> = {
  255: 'RESPONSE_ERROR_UNKNOWN_COMMAND',
  254: 'RESPONSE_ERROR_NOT_INITIALIZED',
  253: 'RESPONSE_ERROR_MEMORY_ERROR',
  252: 'RESPONSE_ERROR_APP_DOMAIN_TOO_LONG',
  251: 'RESPONSE_ERROR_APP_DOMAIN_INVALID',
  250: 'RESPONSE_ERROR_MNEMONIC_TOO_LONG',
  249: 'RESPONSE_ERROR_MNEMONIC_INVALID',
  248: 'RESPONSE_ERROR_GENERATE_MNEMONIC',
  247: 'RESPONSE_ERROR_INPUT_TIMEOUT',
  246: 'RESPONSE_ERROR_NOT_IMPLEMENTED',
  245: 'RESPONSE_ERROR_INPUT_TOO_LONG',
  // 244
  243: 'RESPONSE_ERROR_DEPRECATED',
};

const enum State {
  IDLE,
  SENDING,
  READING,
  WAITING_FOR_USER_CONFIRM,
}

const state_symbol = Symbol('state');
const lock_symbol = Symbol('ready');
const reconnect_symbol = Symbol('reconnect');

let id = 0;

export interface Options {
  baudRate?:
    | 115200
    | 57600
    | 38400
    | 19200
    | 9600
    | 4800
    | 2400
    | 1800
    | 1200
    | 600
    | 300
    | 200
    | 150
    | 134
    | 110
    | 75
    | 50
    | number;
  lock?: boolean;
  log_level?: LogLevel;
  logger?: Logger;
  /**
   * @deprecated  as of **v0.0.2** please use `reject_on_locked` instead
   */
  rejectOnLocked?: boolean;
  reject_on_locked?: boolean;
  /**
   * @deprecated  as of **v0.0.2** please use `reconnect_time` instead
   */
  reconnectTime?: number;
  reconnect_time?: number;
  debug?: boolean;
}

export default class RyderSerial extends Events.EventEmitter {
  #log_level: LogLevel;
  #logger: Logger;

  /** the id of the `RyderSerial` instance */
  id: number;
  /** the port at which the Ryder device (or simulator) is connected */
  port: string;
  /** optional specifications for `RyderSerial`'s behavior (especially regarding connection)  */
  options: Options;
  /** true if `RyderSerial` is in the process of closing */
  closing: boolean;
  /** instantiated on successful connection; sticks around while connection is active */
  connection?: WSConnection;
  /** sequencer implementation to manage process sequencing */
  #train: Train;
  /** current state of the RyderSerial -- either `IDLE`, `SENDING`, `READING` */
  [state_symbol]: State;
  /** array of resolve functions representing locks; locks are released when resolved */
  [lock_symbol]: Array<(value?: unknown) => void>;
  /** timeout that will invoke `this.open()` if we ever go over `this.options.reconnectTimeout` */
  [reconnect_symbol]: NodeJS.Timeout;

  // command constants
  // lifecycle commands
  static readonly COMMAND_WAKE = 1;
  static readonly COMMAND_INFO = 2;
  static readonly COMMAND_SETUP = 10;
  static readonly COMMAND_RESTORE_FROM_SEED = 11;
  static readonly COMMAND_RESTORE_FROM_MNEMONIC = 12;
  static readonly COMMAND_ERASE = 13;
  // export commands
  static readonly COMMAND_EXPORT_OWNER_KEY = 18;
  static readonly COMMAND_EXPORT_OWNER_KEY_PRIVATE_KEY = 19;
  static readonly COMMAND_STACKS_APP_SIGN_IN_REQUEST_LEGACY = 20;
  static readonly COMMAND_EXPORT_APP_KEY_PRIVATE_KEY = 21;
  static readonly COMMAND_EXPORT_OWNER_APP_KEY_PRIVATE_KEY = 23;
  static readonly COMMAND_EXPORT_PUBLIC_IDENTITIES = 30;
  static readonly COMMAND_EXPORT_PUBLIC_IDENTITY = 31;

  // export public keys
  static readonly COMMAND_EXPORT_DERIVED_PUBLIC_KEY = 40;

  // transaction commands
  static readonly COMMAND_REQUEST_TRANSACTION_SIGN = 50;

  // sign message commands
  static readonly COMMAND_REQUEST_IDENTITY_MESSAGE_SIGN = 60;

  // cancel command
  static readonly COMMAND_CANCEL = 100;

  // response constants
  static readonly RESPONSE_OK = RESPONSE_OK;
  static readonly RESPONSE_SEND_INPUT = RESPONSE_SEND_INPUT;
  static readonly RESPONSE_REJECTED = RESPONSE_REJECTED;
  static readonly RESPONSE_LOCKED = RESPONSE_LOCKED;

  /**
   * Construct a new instance of RyderSerial and try to open connection at given port
   * @param port The port at which Ryder device (or simulator) is connected
   * @param options Optional specifications to customize RyderSerial behavior — especially regarding connection
   */
  constructor(port: string, options?: Options) {
    super();
    this.#log_level = options?.log_level ?? LogLevel.SILENT;
    this.#logger = options?.logger ?? make_logger(this.constructor.name);
    this.id = id++;
    this.port = port;
    this.options = options || {};
    if (this.options.debug && !this.options.log_level) {
      this.#log_level = LogLevel.DEBUG;
    }
    // to support now-deprecated `options.reconnectTime`
    if (!this.options.reconnect_time && this.options.reconnectTime) {
      this.options.reconnect_time = this.options.reconnectTime;
    }
    // to support now-deprecated `options.rejectOnLocked`
    if (!this.options.reject_on_locked && this.options.rejectOnLocked) {
      this.options.reject_on_locked = this.options.rejectOnLocked;
    }
    this.#train = new Train();
    this[state_symbol] = State.IDLE;
    this[lock_symbol] = [];
    this.closing = false;
    this.open();
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    const instance_log_level = log_security_level(this.#log_level);
    if (instance_log_level > 0 && log_security_level(level) >= instance_log_level) {
      this.#logger(level, message, extra);
    }
  }

  private serial_error(error: Error): void {
    this.emit('error', error);
    if (!this.#train.is_empty()) {
      const { reject } = this.#train.pop_tail();
      reject(error);
    }
    this[state_symbol] = State.IDLE;
    this.next();
  }

  private async serial_data(dataArray: Uint8Array): Promise<void> {
    const data = Buffer.from(dataArray);
    this.log(LogLevel.DEBUG, 'data from Ryder', {
      data: '0x' + Buffer.from(data).toString('hex'),
      i: data[0],
    });
    if (this[state_symbol] === State.IDLE) {
      this.log(LogLevel.WARN, 'Got data from Ryder without asking, discarding.');
    } else {
      if (this.#train.is_empty()) {
        return;
      }
      const { resolve, reject } = this.#train.peek_front();
      let offset = 0;
      if (this[state_symbol] === State.WAITING_FOR_USER_CONFIRM) {
        // user has confirmed, now continue with reading the data for the last command
        this[state_symbol] = State.READING;
      }
      if (this[state_symbol] === State.SENDING) {
        this.log(LogLevel.DEBUG, `-> SENDING... ryderserial is trying to send data ${data[0]}`);
        if (data[0] === RESPONSE_LOCKED) {
          this.log(
            LogLevel.WARN,
            '!! WARNING: RESPONSE_LOCKED -- RYDER DEVICE IS NEVER SUPPOSED TO EMIT THIS EVENT'
          );
          if (this.options.reject_on_locked) {
            const error = new Error('ERROR_LOCKED');
            this.#train.reject_all_remaining(error);
            this[state_symbol] = State.IDLE;
            this.emit('locked');
            return;
          } else {
            this.emit('locked');
          }
        }
        if (
          data[0] === RESPONSE_OK ||
          data[0] === RESPONSE_SEND_INPUT ||
          data[0] === RESPONSE_REJECTED
        ) {
          this.log(
            LogLevel.DEBUG,
            '---> (while sending): RESPONSE_OK or RESPONSE_SEND_INPUT or RESPONSE_REJECTED'
          );
          this.#train.pop_front();
          resolve(data[0]);
          if (data.length > 1) {
            this.log(LogLevel.DEBUG, 'ryderserial more in buffer');
            return this.serial_data.bind(this)(data.slice(1)); // more responses in the buffer
          }
          this[state_symbol] = State.IDLE;
          this.next();
          return;
        } else if (data[0] === RESPONSE_OUTPUT) {
          this.log(
            LogLevel.DEBUG,
            '---> (while sending): RESPONSE_OUTPUT... ryderserial is ready to read'
          );
          this[state_symbol] = State.READING;
          ++offset;
        } else if (data[0] === RESPONSE_WAIT_USER_CONFIRM) {
          // wait for user to confirm
          this.emit('wait_user_confirm');
          this.log(LogLevel.DEBUG, 'waiting for user confirm on device');
          if (data.length > 1) {
            this.log(LogLevel.DEBUG, 'ryderserial more in buffer');
            return this.serial_data.bind(this)(data.slice(1)); // more responses in the buffer
          }
          this[state_symbol] = State.WAITING_FOR_USER_CONFIRM;
          do {
            await new Promise(r => setTimeout(r, 2000));
            this.send_empty_message();
          } while (this[state_symbol] === State.WAITING_FOR_USER_CONFIRM);
          return;
        } else {
          // error
          const error = new Error(
            data[0] in response_errors
              ? response_errors[data[0]] // known error
              : 'ERROR_UNKNOWN_RESPONSE' + data[0] // unknown error
          );
          this.log(LogLevel.ERROR, '---> (while sending): ryderserial ran into an error', {
            error,
          });
          reject(error);
          this.#train.pop_front();
          this[state_symbol] = State.IDLE;
          if (data.length > 1) {
            this.log(LogLevel.DEBUG, 'ryderserial more in buffer');
            return this.serial_data.bind(this)(data.slice(1)); // more responses in the buffer
          }
          this.next();
          return;
        }
      }
      if (
        this[state_symbol] === State.READING ||
        this[state_symbol] === State.WAITING_FOR_USER_CONFIRM
      ) {
        this.log(
          LogLevel.INFO,
          '---> (during response_output): READING... ryderserial is trying to read data'
        );
        for (let i = offset; i < data.byteLength; ++i) {
          const b = data[i];
          // if previous was not escape byte
          if (!this.#train.peek_front().is_prev_escaped_byte) {
            if (b === RESPONSE_ESC_SEQUENCE) {
              // escape previous byte
              this.#train.peek_front().is_prev_escaped_byte = true;
              continue; // skip this byte
            } else if (b === RESPONSE_OUTPUT_END) {
              this.#log_level == LogLevel.DEBUG &&
                this.log(LogLevel.DEBUG, '---> READING SUCCESS resolving output buffer', {
                  output_buffer: Buffer.from(
                    this.#train.peek_front().output_buffer,
                    'binary'
                  ).toString('hex'),
                });
              // resolve output buffer
              resolve(this.#train.pop_front().output_buffer);
              this[state_symbol] = State.IDLE;
              this.next();
              return;
            }
          }
          // else, previous was escape byte
          this.#train.peek_front().is_prev_escaped_byte = false;
          this.#train.peek_front().output_buffer += String.fromCharCode(b);
        }
      }
    }
  }

  private send_empty_message() {
    try {
      if (this.connection) {
        this.connection.write(Buffer.from([]));
        this.log(LogLevel.DEBUG, `sent empty message`);
      } else {
        this.log(LogLevel.ERROR, `no connection`);
        this.serial_error(new Error('no connection'));
      }
    } catch (error) {
      this.log(LogLevel.ERROR, `encountered error while sending data: ${error}`);
      this.serial_error(error as Error);
      return;
    }
  }

  /**
   * Attempts to (re)open a new connection to serial port and initialize Event listeners.
   *
   * NOTE that a connection is opened automatically when a `RyderSerial` object is constructed.
   *
   * @param port The port to connect to. If omitted, fallback to `this.port`
   * @param options Specific options to drive behavior. If omitted, fallback to `this.options` or `DEFAULT_OPTIONS`
   */
  public open(port?: string, options?: Options): void {
    this.log(LogLevel.DEBUG, `ryderserial attempt open ${this.connection?.isOpen()}`);
    this.closing = false;

    // if connection is already open
    if (this.connection?.isOpen) {
      // TODO: what if client code is intentionally trying to open connection to a new port for some reason? Or passed in new options?
      return; // return out, we don't need to open a new connection
    }
    // if connection is defined, but it's actively closed
    if (this.connection) {
      // close RyderSerial b/c client is trying to open a new connection.
      // `this.close()` will clear all interval timeouts, set destroy `this.serial`, reject all pending processes, and unlock all locks.
      this.close();
    }
    this.port = port || this.port;
    this.options = options || this.options || {};
    if (!this.options.baudRate) {
      this.options.baudRate = 115_200;
    }
    if (!this.options.lock) {
      this.options.lock = true;
    }
    if (!this.options.reconnect_time) {
      this.options.reconnect_time = 2_000;
    }
    this.connection = new WSConnection(this.port, this.options);

    this.connection.on('data', (data: any) => {
      this.log(LogLevel.DEBUG, "this.serial ran into 'data' event");
      this.serial_data.bind(this)(data);
    });
    this.connection.on('error', (error: any) => {
      this.log(LogLevel.WARN, `\`this.serial\` encountered an error: ${error}`);
      if (this.connection && !this.connection.isOpen) {
        clearInterval(this[reconnect_symbol]);
        this[reconnect_symbol] = setInterval(this.open.bind(this), this.options.reconnect_time);
        this.emit('failed', error);
      }
      this.serial_error.bind(this);
    });
    this.connection.on('close', () => {
      this.log(LogLevel.DEBUG, 'ryderserial close');
      this.emit('close');
      clearInterval(this[reconnect_symbol]);
      if (!this.closing) {
        this[reconnect_symbol] = setInterval(this.open.bind(this), this.options.reconnect_time);
      }
    });
    this.connection.on('open', () => {
      this.log(LogLevel.DEBUG, 'ryderserial open');
      clearInterval(this[reconnect_symbol]);
      this.emit('open');
      this.next();
    });
  }

  /**
   * Close down `this.connection` connection and reset `RyderSerial`
   *
   * All tasks include:
   * - clear watchdog timeout,
   * - reject pending processes,
   * - release all locks.
   * - close connection,
   * - clear reconnect interval
   * - destroy `this.serial`
   */
  public close(): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.clear(); // clears watchdog timeout, rejects all pending processes, and releases all locks.
    this.connection?.close(); // close connection if it exists
    clearInterval(this[reconnect_symbol]); // clear reconnect interval
    delete this.connection; // destroy connection
  }

  /**
   * @returns `true` if RyderSerial is currently locked; `false` otherwise
   */
  public locked(): boolean {
    return !!this[lock_symbol].length;
  }

  /**
   * Requests a lock to be placed so that commands can be sent in sequence.
   *
   * @returns a `Promise` that resolves when the lock is released.
   */
  public lock(): Promise<void> {
    this.log(LogLevel.DEBUG, '\tLOCK... ryderserial lock');
    this[lock_symbol].push(Promise.resolve);
    return Promise.resolve();
  }

  /**
   * Releases the last lock that was requested.
   *
   * Be sure to call this after calling `lock()`, otherwise the serial connection may be blocked until your
   * app exits or the Ryder disconnects.
   */
  public unlock(): void {
    if (this[lock_symbol].length) {
      this.log(LogLevel.DEBUG, 'ryderserial unlock');
      const resolve = this[lock_symbol].shift();
      resolve && resolve();
    }
  }

  /**
   * A utility function that requests a lock and executes the callback once the lock has been granted.
   *
   * Once the callback resolves, it will then release the lock.
   *
   * Useful to chain commands whilst making your application less error-prone (forgetting to call `unlock()`).
   *
   * @returns a `Promise` that resolves to whatever the given `callback` returns.
   */
  public sequence<T>(callback: () => T): Promise<T> {
    if (typeof callback !== 'function' || callback.constructor.name !== 'AsyncFunction') {
      return Promise.reject(new Error('ERROR_SEQUENCE_NOT_ASYNC'));
    }
    return this.lock().then(callback).finally(this.unlock.bind(this));
  }

  /**
   * Send a command and/or data to the Ryder device.
   * The command will be queued and executed once preceding commands have completed.
   *
   * Data can be passed in as a number (as byte), string
   * Set `prepend` to `true` to put the data on the top of the queue.
   *
   * @param data A command or data to send to the Ryder device
   * @param prepend Set to `true` to put data on top of the queue.
   * @returns A `Promise` that resolves with response from the Ryder device (includes waiting for a possible user confirm). The returned data may be a single byte (see static members of this class) and/or resulting data, like an identity or app key.
   */
  public send(
    data: string | number | number[] | Uint8Array | Buffer,
    prepend?: boolean
  ): Promise<string | number> {
    // if `this.serial` is `undefined` or NOT open, then we do not have a connection
    if (!this.connection?.isOpen) {
      // reject because we do not have a connection
      return Promise.reject(new Error('ERROR_DISCONNECTED'));
    }
    let buff: Buffer;
    if (typeof data === 'string') {
      buff = Buffer.from(data, 'binary');
    } else if (typeof data === 'number') {
      buff = Buffer.from([data]);
    } else {
      // Uint8Array or number[]
      buff = Buffer.from(data);
    }

    this.#log_level == LogLevel.DEBUG &&
      this.log(LogLevel.DEBUG, 'queue data for Ryder: ' + buff.length + ' byte(s)', {
        bytes: buff.toString('hex'),
        data,
      });
    return new Promise((resolve, reject) => {
      const c: Entry = {
        data: buff,
        resolve,
        reject,
        is_prev_escaped_byte: false,
        output_buffer: '',
      };
      prepend ? this.#train.push_front(c) : this.#train.push_tail(c);
      this.next();
    });
  }

  /**
   * Moves on to the next command in the queue.
   *
   * This method should ordinarily **not** be called directly.
   * The library takes care of queueing and will call `next()` at the right time.
   */
  private next(): void {
    if (this[state_symbol] === State.IDLE && !this.#train.is_empty()) {
      this.log(LogLevel.INFO, '-> NEXT... ryderserial is moving to next task');
      if (!this.connection?.isOpen) {
        // `this.serial` is undefined or not open
        this.log(LogLevel.ERROR, 'ryderserial connection to port has shut down');
        const { reject } = this.#train.peek_front();
        this.clear();
        reject(new Error('ERROR_DISCONNECTED'));
        return;
      }
      this[state_symbol] = State.SENDING;
      this.#log_level == LogLevel.DEBUG &&
        this.log(
          LogLevel.DEBUG,
          'send data to Ryder: ' + this.#train.peek_front().data.byteLength + ' byte(s)',
          {
            bytes: this.#train.peek_front().data.toString('hex'),
          }
        );
      try {
        this.connection.write(this.#train.peek_front().data);
      } catch (error) {
        this.log(LogLevel.ERROR, `encountered error while sending data: ${error}`);
        this.serial_error(error as Error);
        return;
      }
    } else {
      this.log(LogLevel.INFO, '-> IDLE... ryderserial is waiting for next task.');
    }
  }

  /**
   * Reset `RyderSerial` processes and locks.
   *
   * All tasks include:
   * - clear watchdog timeout
   * - reject all pending processes
   * - set state to `IDLE`
   * - release all locks
   */
  public clear(): void {
    this.#train.reject_all_remaining();
    this[state_symbol] = State.IDLE;
    for (let i = 0; i < this[lock_symbol].length; ++i)
      this[lock_symbol][i] && this[lock_symbol][i](); // release all locks
    this[lock_symbol] = [];
  }
}
