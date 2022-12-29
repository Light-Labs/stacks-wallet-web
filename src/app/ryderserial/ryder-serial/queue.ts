// Types for queuing commands and handling their responses in order.

/*
 * A command or other data to be sent to the Ryder device.
 */
export interface Command {
  /*
   * The data to be sent, which can be a command or arbitrary data.
   */
  data: Buffer;
  /*
   * The callback to be called with the device's response in case of success.
   */
  resolve: (value?: any) => void;
  /*
   * The callback to be called with the error in case of failure.
   */
  reject: (error?: Error) => void;
}

/*
 * A queue of commands waiting to be sent to the Ryder device. The command at the head of the queue
 * was most recently sent to the device, and any data received from the device corresponds to it.
 */
export class CommandQueue {
  commands: Array<Entry>;

  constructor() {
    this.commands = [];
  }

  /*
   * Returns whether there are no commands in the queue.
   */
  is_empty(): boolean {
    return this.commands.length === 0;
  }

  /*
   * Adds a command to the end of the queue, to be ran after all existing ones have completed.
   */
  add(entry: Entry): void {
    this.commands.push(entry);
  }

  /*
   * Adds a command to the queue with priority, to be ran after the current command has completed
   * (or immediately if the queue is empty).
   */
  add_priority(entry: Entry): void {
    this.commands.splice(1, 0, entry);
  }

  /*
   * Removes and returns the command at the head of the queue.
   */
  remove(): Entry {
    const popped = this.commands.shift();
    if (!popped) {
      throw new Error('No commands in queue');
    }
    return popped;
  }

  /*
   * Returns the command at the head of the queue without removing it.
   */
  peek(): Entry {
    if (this.is_empty()) {
      throw new Error('No commands in queue');
    }
    return this.commands[0];
  }

  /*
   * Cancels all commands in the queue, returning a cancellation error to each one.
   */
  cancel_all(): void {
    let error = new Error('ERROR_CANCELED');
    for (let i = 0; i < this.commands.length; ++i) {
      this.commands[i].reject(error);
    }
    this.commands = [];
  }
}
