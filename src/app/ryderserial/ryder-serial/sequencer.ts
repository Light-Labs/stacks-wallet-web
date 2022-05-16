export interface Entry {
    data: Buffer;
    resolve: (value?: any) => void;
    reject: (error?: Error) => void;
    is_prev_escaped_byte: boolean;
    output_buffer: string;
}

export default class Train {
    sequence: Array<Entry>;

    constructor() {
        this.sequence = [];
    }

    get length(): number {
        return this.sequence.length;
    }

    get(i: number): Entry {
        return this.sequence[i];
    }

    is_empty(): boolean {
        return this.sequence.length === 0;
    }

    push_tail(entry: Entry): number {
        return this.sequence.push(entry);
    }

    push_front(entry: Entry): number {
        return this.sequence.unshift(entry);
    }

    pop_front(): Entry {
        const popped = this.sequence.shift();
        if (!popped) {
            throw new Error("No entries in train");
        }
        return popped;
    }

    pop_tail(): Entry {
        const popped = this.sequence.pop();
        if (!popped) {
            throw new Error("No entries in train");
        }
        return popped;
    }

    peek_front(): Entry {
        if (this.is_empty()) {
            throw new Error("No entries in train");
        }
        return this.sequence[0];
    }

    peek_tail(): Entry {
        if (this.is_empty()) {
            throw new Error("No entries in train");
        }
        return this.sequence[this.sequence.length - 1];
    }

    reject_all_remaining(error?: Error): void {
        if (error === undefined) {
            error = new Error("ERROR_CLEARED");
        }
        for (let i = 0; i < this.sequence.length; ++i) {
            this.sequence[i].reject(error);
        }
        this.sequence = [];
    }
}
