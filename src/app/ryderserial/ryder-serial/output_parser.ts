import { RESPONSE_OUTPUT, RESPONSE_OUTPUT_END, RESPONSE_ESC_SEQUENCE } from "./responses";

/* The kind of output received from the Ryder device. */
enum OutputKind {
  /* A single-byte response. */
  Single,
  /* A multi-byte response. */
  Multi,
}

/*
 * An online parser for output from the Ryder device. Handles both single- and multi-byte output,
 * works with partial data supplied as it is received, and can indicate when the output is
 * completed.
 */
export class OutputParser {
  /* A buffer to store the parsed output. */
  private buffer: string;
  private kind?: OutputKind;
  /* Whether the output is completed (i.e., no more data is expected). */
  private completed: boolean;
  /* Whether to escape the next byte received. */
  private escape_next_byte: boolean;

  /* Initializes an empty output parser, ready to receive data. */
  constructor() {
    this.buffer = '';
    this.completed = false;
    this.escape_next_byte = false;
  }

  /*
   * Adds data to the output parser and returns the output if it is complete.
   *
   * @param data The data to add to the output, interpreted as a byte array.
   */
  add_data(data: string): string | undefined {
    // TODO: unit tests
    if (this.completed) {
      throw new Error('`add_data` called on completed output');
    }

    // If adding no data, do nothing
    if (data.length === 0) {
      return;
    }

    // If this is the first data received, check whether it is single- or multi-byte output
    let is_first_byte = this.kind === undefined;
    if (is_first_byte) {
      if (data.charCodeAt(0) === RESPONSE_OUTPUT) {
        // This is the beginning of a multi-byte output
        this.kind = OutputKind.Multi;
      } else {
        // All other bytes come by themselves
        this.kind = OutputKind.Single;
      }
    }

    // Whether there was more data than expected for a single command's output
    let extra_data = false;

    if (this.kind === OutputKind.Single) {
      this.buffer += data[0];
      this.completed = true;

      // Detect if there is more data than expected
      if (data.length > 1) {
        extra_data = true;
      }
    } else if (this.kind === OutputKind.Multi) {
      for (let i = 0; i < data.length; i++) {
        // Detect if there is more data than expected
        if (this.completed) {
          extra_data = true;
          break;
        }

        const byte = data.charCodeAt(i);

        if (this.escape_next_byte) {
          // Escaped bytes are added as-is
          this.buffer += String.fromCharCode(byte);
          this.escape_next_byte = false;
        } else if (byte === RESPONSE_ESC_SEQUENCE) {
          // Escape the next byte
          this.escape_next_byte = true;
        } else if (byte === RESPONSE_OUTPUT && is_first_byte) {
          // The initial `RESPONSE_OUTPUT` is ignored (it just signals multi-byte data)
        } else if (byte === RESPONSE_OUTPUT_END) {
          // `RESPONSE_OUTPUT_END` signals the end of the data but is not part of the data itself
          this.completed = true;
        } else {
          // All other bytes are added as-is
          this.buffer += String.fromCharCode(byte);
        }

        is_first_byte = false;
      }
    }

    if (extra_data) {
      // This may occur if two commands are sent to the Ryder device before the first's output is
      // handled, but RyderSerial's queue should prevent this
      throw new Error('extraneous data provided to `add_data`');
    }

    // Return the output if it is completed
    if (this.completed) {
      return this.buffer;
    }
  }

  /*
   * Returns whether this output is a single-byte response, or undefined if no data has been
   * provided to the parser.
   */
  is_single_byte(): boolean | undefined {
    if (this.kind === undefined) {
      return undefined;
    } else {
      return this.kind === OutputKind.Single;
    }
  }
}

