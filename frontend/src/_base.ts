class Log {
    public debug: boolean;
    public name: string;

    constructor() {
        this.debug = !!$("body").attr("data-debug") || false;
    }

    time(): string {
        const date = new Date();
        return (
            `${date.getHours()}:${date.getMinutes()}:` +
            `${date.getSeconds()}.${date.getMilliseconds()}`
        );
    }

    log(...args: string[]): undefined {
        if (this.debug) {
            const name = `[${this.constructor.name}] (${this.time()})`;
            const log_args = [name].concat(Array.prototype.slice.call(args, 0));
            return console.log.apply(console, log_args);
        }
    }

    dbg(...args: string[]): undefined {
        if (this.debug) {
            const name = `[${this.constructor.name}] (${this.time()})`;
            const log_args = [name].concat(Array.prototype.slice.call(args, 0));
            return console.debug.apply(console, log_args);
        }
    }

    fail(...args: string[]): undefined {
        const { name } = this.constructor;
        const log_args = [name].concat(Array.prototype.slice.call(args, 0));
        return console.error.apply(console, log_args);
    }
}

export { Log };
