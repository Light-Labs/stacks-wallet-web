import Events from 'events'; // https://nodejs.org/api/events.html#events_class_eventemitter
import { LogLevel, Logger, make_logger, log_security_level } from '../logging';
import { WSConnection } from '../connection/ws';
import { CommandQueue, Command } from './queue';
import { OutputParser } from './output_parser';
import {
  RESPONSE_OK,
  RESPONSE_SEND_INPUT,
  RESPONSE_REJECTED,
  RESPONSE_OUTPUT,
  RESPONSE_OUTPUT_END,
  RESPONSE_ESC_SEQUENCE,
  RESPONSE_WAIT_USER_CONFIRM,
  RESPONSE_LOCKED,
  response_errors,
  BRIDGE_RESPONSE_WAIT_IN_QUEUE,
  BRIDGE_RESPONSE_BEING_SERVED,
  BRIDGE_RESPONSE_SHUTDOWN,
  BRIDGE_RESPONSE_DEVICE_NOT_CONNECTED,
  BRIDGE_RESPONSE_DEVICE_DISCONNECTED,
} from './responses';

/* The current state of the Ryder device client. */
const enum State {
  /* The connection to the Ryder device is closed, but may be reopened. */
  CLOSED,
  /*
   * The connection was just opened, and the client is now waiting for the bridge to indicate its
   * state with its initial response (either available or busy).
   */
  WAITING_FOR_BRIDGE_STATE_RESPONSE,
  /* The client is waiting to be given a command to send. */
  IDLE,
  /* The client is sending a command. */
  SENDING,
  /* The client is waiting for a command's response. */
  READING,
  /* The client is waiting for the user to interact with a confirmation dialog on the device. */
  WAITING_FOR_USER_CONFIRM,
  /*
   * Like `CLOSED`, but the connection will never be reopened. No further state changes should
   * occur once this state is reached.
   */
  CLOSED_PERMANENTLY,
}

/* The global, unique identifier for `RyderSerial` objects. */
let id = 0;

/* Configuration option for a `RyderSerial` object. */
export interface Options {
  /* An optional log level. `LogLevel.SILENT` will be used if none is provided. */
  log_level?: LogLevel;
  /* An optional logger. A new one will be created if none is provided. */
  logger?: Logger;
  /*
   * How long to wait between each attempt to reconnect to the device when not connected, in
   * milliseconds.
   */
  reconnect_interval_ms?: number;
}

/* A client that provides an interface to interact with a Ryder device. Generally, only a single
 * open instance should exist at once, or all after the first will be disconnected because the
 * device is busy (though they may later reconnect when the device becomes available).
 */
export default class RyderSerial extends Events.EventEmitter {
  private log_level: LogLevel;
  private logger: Logger;

  /* The id of the `RyderSerial` instance. */
  readonly id: number;
  /* The URL of the Ryder bridge. */
  bridge_url: string;
  /* Configuration of the `RyderSerial`'s behavior. */
  options: Options;
  /* The connection to the Ryder bridge, or undefined if the connection is currently closed. */
  private connection?: WSConnection;
  /* The queue for commands and data to be sent to the Ryder device. */
  private queue: CommandQueue;
  /* The current state of the `RyderSerial`. */
  private state: State;
  /*
   * A parser to parse and combine partial responses from the Ryder device before they are
   * returned to `RyderSerial` callers in completed form.
   */
  private partial_device_output?: OutputParser;
  // TODO: implement a lock for the RyderSerial
  // [lock_symbol]: Array<(value?: unknown) => void>;
  /*
   * A timer that attempts to reconnect to the Ryder bridge after the reconnection interval if the
   * connection is ever closed.
   */
  private reconnect_timer?: NodeJS.Timeout;

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

  // sign structed message command
  static readonly COMMAND_REQUEST_STRUCTURED_MESSAGE_SIGN = 51;

  // sign message commands
  static readonly COMMAND_REQUEST_IDENTITY_MESSAGE_SIGN = 60;

  // cancel command
  static readonly COMMAND_CANCEL = 100;

  // response constants
  static readonly RESPONSE_OK = RESPONSE_OK;
  static readonly RESPONSE_SEND_INPUT = RESPONSE_SEND_INPUT;
  static readonly RESPONSE_REJECTED = RESPONSE_REJECTED;
  static readonly RESPONSE_LOCKED = RESPONSE_LOCKED;

  /*
   * Constructs a the new instance of `RyderSerial` and tries to open a connection to the Ryder
   * bridge at the given URL.
   *
   * @param bridge_url The URL of the Ryder bridge.
   * @param options Optional configuration of the `RyderSerial`'s behavior.
   */
  constructor(bridge_url: string, options?: Options) {
    super();
    this.log_level = options?.log_level ?? LogLevel.SILENT;
    this.logger = options?.logger ?? make_logger(this.constructor.name);
    this.id = id++;
    this.bridge_url = bridge_url;
    this.options = options || {};
    this.queue = new CommandQueue();
    this.set_state(State.CLOSED);
    this.connect_to_bridge();
  }

  /* Logs a message and an optional record to the logger at the given log level. */
  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    const instance_log_level = log_security_level(this.log_level);
    if (instance_log_level > 0 && log_security_level(level) >= instance_log_level) {
      this.logger(level, message, extra);
    }
  }

  private set_state(state: State) {
    this.log(LogLevel.DEBUG, `Changing state to ${State[state]} (instance id ${this.id})`);
    this.state = state;
  }

  /*
   * Attempts to (re)open a new connection to the Ryder bridge. This is called once automatically
   * when the `RyderSerial` is first constructed, and repeatedly while the connection is closed.
   *
   * Does nothing if the connection is already open or if the `RyderSerial` is permanently closed.
   */
  private connect_to_bridge(): void {
    if (this.connection?.isOpen || this.state === State.CLOSED_PERMANENTLY) {
      return;
    }

    this.log(LogLevel.DEBUG, `Connecting to the bridge (instance id ${this.id})`);

    // Open the connection
    this.connection = new WSConnection(this.bridge_url);

    // Register event listeners
    this.connection.on('open', () => {
      this.on_open.bind(this)();
    });
    this.connection.on('data', (data: any) => {
      this.on_response.bind(this)(data);
    });
    this.connection.on('error', (error: any) => {
      this.on_error.bind(this)(error);
    });
    this.connection.on('close', () => {
      this.on_close.bind(this)();
    });
  }

  /*
   * Schedules repeated attempts to reconnect to the bridge, separated by a delay of
   * `this.options.reconnect_interval_ms`.
   */
  private set_reconnect_interval() {
    let delay = this.options.reconnect_time || 1000;
    this.log(LogLevel.DEBUG, `Retrying connection in ${delay} ms`);
    // Clear the previous timer
    clearInterval(this.reconnect_timer);
    // Create a new one
    this.reconnect_timer = setInterval(
      this.connect_to_bridge.bind(this),
      delay,
    );
  }

  /*
   * Handles the WebSocket connection opening successfully. Note that this does not mean that the
   * `RyderSerial` is ready for use, because the bridge may later indicate that another client
   * already has control of the device.
   */
  private on_open() {
    this.log(LogLevel.DEBUG, 'WS connection opened');
    this.set_state(State.WAITING_FOR_BRIDGE_STATE_RESPONSE);
    // Remove any reconnection timer because the connection is now open
    clearInterval(this.reconnect_timer);
  }

  /* Handles errors encountered while interacting with the Ryder bridge or device. */
  private on_error(error: Error) {
    // Note that `on_close` will be called on error as well
    this.log(LogLevel.ERROR, `Error in Ryder bridge or device connection: ${error}`);
    // This causes an uncaught error, but 'failed' seems to be caught correctly
    // this.emit('error', error);
    this.emit('failed', error);
    // Clear the command queue
    this.queue.cancel_all();
    // Close the bridge connection if it isn't already closed
    this.close_connection();
    // Retry the connection after a delay
    this.set_reconnect_interval();
  }

  /* Handles the connection closing for any reason. */
  private on_close() {
    this.log(LogLevel.DEBUG, 'WS connection closed');
    // Only update the state if the `RyderSerial` is not permanently closed
    if (this.state !== State.CLOSED_PERMANENTLY) {
      this.set_state(State.CLOSED);
    }
    this.emit('close');
    // Clear the command queue
    this.queue.cancel_all();
  }

  /* Handles responses received from the Ryder bridge and device. */
  private on_response(response: string | object) {
    if (typeof response === 'string') {
      // String responses come from the bridge and are handled separately
      this.on_bridge_response(response);
    } else {
      // Binary responses come from the device
      response.arrayBuffer().then((data) => {
        this.on_raw_device_response.bind(this)(data);
      });
    }
  }

  /* Handles a response from the bridge itself. */
  private on_bridge_response(response: string) {
    switch (response) {
      case BRIDGE_RESPONSE_WAIT_IN_QUEUE:
        // It is possible to wait here as well, but this could lead to deadlock situations if the
        // user isn't careful
        this.on_error(new Error('ERROR_DEVICE_BUSY'));
        break;
      case BRIDGE_RESPONSE_BEING_SERVED:
        // The Ryder device is now available through the bridge, so notify the caller and update the
        // state accordingly
        this.log(LogLevel.DEBUG, 'Ryder device now available');
        this.set_state(State.IDLE);
        this.emit('open');
        break;
      case BRIDGE_RESPONSE_SHUTDOWN:
        // The bridge is shutting down
        this.on_error(new Error('ERROR_BRIDGE_SHUTDOWN'));
        break;
      case BRIDGE_RESPONSE_DEVICE_NOT_CONNECTED:
        // The bridge is not connected to the device (only returned when first connecting)
        this.on_error(new Error('ERROR_DEVICE_NOT_CONNECTED'));
        break;
      case BRIDGE_RESPONSE_DEVICE_DISCONNECTED:
        // The bridge lost its connection to the device
        this.on_error(new Error('ERROR_DEVICE_DISCONNECTED'));
        break;
      default:
        this.log(LogLevel.WARN, 'Received unknown bridge response', { response });
        break;
    }
  }

  /*
   * Handles raw data received from the Ryder device. This function only reconstructs complete
   * device responses from the fragments received and then passes them to `on_device_response` to be
   * handled.
   */
  private on_raw_device_response(raw_data: object) {
    const buffer = Buffer.from(raw_data);
    const data = Uint8Array.from(buffer);
    const data_hex = buffer.toString('hex');

    // Data should only be received during reading states
    if (!(this.state === State.READING || this.state === State.WAITING_FOR_USER_CONFIRM)) {
      throw new Error(`received device response unexpectedly: 0x${data_hex}`);
    }

    this.log(LogLevel.DEBUG, 'Data from Ryder', {
      data: '0x' + data_hex,
      i: data[0],
    });

    // Initialize a parser to handle the response if none exists
    if (this.partial_device_output === undefined) {
      this.partial_device_output = new OutputParser();
    }

    // Add the received data to it
    let completed_data = this.partial_device_output.add_data(data);

    // Check if the complete response is now available
    if (completed_data !== undefined) {
      const is_single_byte = this.partial_device_output.is_single_byte();

      // Delete this parser to prepare for the next response
      delete this.partial_device_output;

      this.log(LogLevel.DEBUG, 'Completed response from Ryder', {
        data: '0x' + Buffer.from(completed_data, 'binary').toString('hex'),
        is_single_byte,
      });

      // Handle the completed response
      this.on_device_response(completed_data, is_single_byte);
    }
  }

  /*
   * Handles completed responses that were reconstructed by `on_raw_device_response`.
   *
   * @param response The complete response.
   * @param is_single_byte Whether `response` represents a single-byte response from the device.
   */
  private on_device_response(response: Uint8Array, is_single_byte: boolean) {
    // The response to return to the corresponding command if one is available, which may be either
    // data or an error
    let result;

    if (is_single_byte === true) {
      const byte = response[0];
      switch (byte) {
        // Simple responses that are just returned to the command
        case RESPONSE_OK:
        case RESPONSE_SEND_INPUT:
        case RESPONSE_REJECTED:
          result = response;
          break;
        // Special responses that are not returned to the command
        case RESPONSE_WAIT_USER_CONFIRM:
          // Update the state and notify the caller, but continue waiting for the followup response
          this.set_state(State.WAITING_FOR_USER_CONFIRM);
          this.emit('wait_user_confirm');
          break;
        case RESPONSE_LOCKED:
          // The device should never be locked, so this response is an error
          this.log(
            LogLevel.ERROR,
            'RESPONSE_LOCKED -- RYDER DEVICE IS NEVER SUPPOSED TO EMIT THIS EVENT'
          );
          this.emit('locked');
          this.on_error(new Error('ERROR_LOCKED'));
          break;
        default:
          if (byte in response_errors) {
            // Error responses
            result = new Error(response_errors[byte]);
          } else {
            // Unknown responses
            result = new Error('ERROR_UNKNOWN_RESPONSE_' + byte);
          }
          break;
      }
    } else if (is_single_byte === false) {
      // Multi-byte data is not special, so it is just returned
      result = response;
    }

    // If a response to the command is available, return it and remove the command from the queue
    if (result !== undefined) {
      let { resolve, reject } = this.queue.remove();

      if (result instanceof Error) {
        reject(result);
      } else {
        // Convert the result to a string
        let result_string = Buffer.from(result).toString('binary');
        resolve(result_string);
      }

      // The command is now fully handled, so process the next one in the queue
      this.set_state(State.IDLE);
      this.process_next_command();
    }
  }

  /*
   * Sends the next command in the queue to the Ryder device if the queue is not empty.
   */
  private process_next_command(): void {
    if (this.state !== State.IDLE) {
      throw new Error('`process_next_command` called when not waiting for commands');
    }

    if (!this.connection?.isOpen) {
      throw new Error('`process_next_command` called while the connection is closed');
    }

    if (!this.queue.is_empty()) {
      // Get the next command in the queue
      const { data, reject } = this.queue.peek();

      this.log(
        LogLevel.DEBUG,
        `Sending data to Ryder: ${data.byteLength} byte(s)`,
        {
          bytes: data.toString('hex'),
        }
      );

      try {
        this.set_state(State.SENDING);
        this.connection.write(data);
        this.set_state(State.READING);
      } catch (error) {
        this.log(LogLevel.ERROR, `Encountered error while sending data: ${error}`);
        this.on_error(error as Error);
      }
    }
  }

  /*
   * Sends a command and/or data to the Ryder device. The command will be placed in a queue and
   * executed once all preceding commands have completed.
   *
   * `data` can be either:
   * - A single byte (a number)
   * - An array of bytes
   * - A string (which will be interpreted as an array of bytes)
   *
   * If `priority` is true, the command will be executed immediately after the current one
   * finishes, or immediately if the queue is empty.
   *
   * @param data The command or data to send
   * @param priority Whether to execute this command as soon as possible
   * @returns A `Promise` that resolves with the Ryder device's response to the command, or an error
   * if the device returned an error response or if the command was canceled for any reason
   */
  public send(
    data: string | number | number[] | Uint8Array | Buffer,
    priority?: boolean,
  ): Promise<string> {
    // Check that the `RyderSerial` is ready to send commands
    if (this.state !== State.IDLE) {
      throw new Error('`send` called while not in idle state');
    }

    // Convert `data` to the correct type
    let buff: Buffer;
    if (typeof data === 'string') {
      buff = Buffer.from(data, 'binary');
    } else if (typeof data === 'number') {
      buff = Buffer.from([data]);
    } else {
      // Uint8Array or number[]
      buff = Buffer.from(data);
    }

    this.log(LogLevel.DEBUG, `Adding command to queue: ${buff.length} byte(s)`, {
      bytes: buff.toString('hex'),
      data,
    });

    return new Promise((resolve, reject) => {
      const c: Command = {
        data: buff,
        resolve,
        reject,
      };

      // Add the command to the queue
      let is_first_command = this.queue.is_empty();
      if (priority) {
        this.queue.add_priority(c);
      } else {
        this.queue.add(c)
      }

      // Process it immediately if it is the first in the queue
      if (is_first_command) {
        this.process_next_command();
      }
    });
  }

  /*
   * Closes the bridge connection without scheduling a reconnection attempt.
   */
  private close_connection(): void {
    this.connection?.close();
    delete this.connection;
  }

  /*
   * Closes the `RyderSerial` and its connection to the bridge permanently. To reopen the
   * connection, a new `RyderSerial` must be created.
   */
  public close(): void {
    if (this.state === State.CLOSED_PERMANENTLY) {
      return;
    }

    this.set_state(State.CLOSED_PERMANENTLY);
    // Cancel reconnection attempts
    clearInterval(this.reconnect_timer);
    // Close the bridge connection
    this.close_connection();
    // Cancel pending commands
    this.queue.cancel_all();
  }
}

