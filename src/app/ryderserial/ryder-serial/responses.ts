// Ryder device and bridge response constants.

// Device responses

export const RESPONSE_OK = 1; // generic command ok/received
export const RESPONSE_SEND_INPUT = 2; // command received, send input
export const RESPONSE_REJECTED = 3; // user input rejected
export const RESPONSE_OUTPUT = 4; // sending output
export const RESPONSE_OUTPUT_END = 5; // end of output
export const RESPONSE_ESC_SEQUENCE = 6; // output esc sequence
export const RESPONSE_WAIT_USER_CONFIRM = 10; // user has to confirm action
export const RESPONSE_LOCKED = 11; // device is locked, send PIN

// error responses
export const response_errors: Record<number, string> = {
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

// Bridge responses

export const BRIDGE_RESPONSE_WAIT_IN_QUEUE: string = 'RESPONSE_WAIT_IN_QUEUE';
export const BRIDGE_RESPONSE_BEING_SERVED: string = 'RESPONSE_BEING_SERVED';
export const BRIDGE_RESPONSE_SHUTDOWN: string = 'RESPONSE_BRIDGE_SHUTDOWN';
export const BRIDGE_RESPONSE_DEVICE_NOT_CONNECTED: string = 'RESPONSE_DEVICE_NOT_CONNECTED';
export const BRIDGE_RESPONSE_DEVICE_DISCONNECTED: string = 'RESPONSE_DEVICE_DISCONNECTED';
