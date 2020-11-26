import { Log } from "./_base";

class Websocket extends Log {
    public wdb: any;
    public url: string;
    public ws: WebSocket;

    constructor(wdb: any, uuid: string) {
        super();
        this.wdb = wdb;
        super();
        // Open a websocket in case of request break
        const proto = document.location.protocol === "https:" ? "wss:" : "ws:";
        this.url = `${proto}//${document.location.host}/websocket/${uuid}`;
        this.log("Opening new socket", this.url);
        this.ws = new WebSocket(this.url);
        this.ws.onclose = this.close.bind(this);
        this.ws.onopen = this.open.bind(this);
        this.ws.onerror = this.error.bind(this);
        this.ws.onmessage = this.message.bind(this);
    }

    close(m: any) {
        this.log("Closed", m);
        return this.wdb.die();
    }

    error(m: any) {
        return this.fail("Error", m);
    }

    open(m: any) {
        // We are connected, ie: in request break
        this.log("Open", m);
        return this.wdb.opening();
    }

    message(m: any) {
        // Open a websocket in case of request break
        let cmd, data;
        const message = m.data;
        const pipe = message.indexOf("|");
        if (pipe > -1) {
            cmd = message.substr(0, pipe);
            data = JSON.parse(message.substr(pipe + 1));
        } else {
            cmd = message;
        }
        this.dbg(this.time(), "<-", message);
        cmd = cmd.toLowerCase();
        if (cmd in this.wdb) {
            return this.wdb[cmd.toLowerCase()](data);
        } else {
            return this.fail("Unknown command", cmd);
        }
    }

    send(cmd: any, data: any = null) {
        let msg;
        if (data) {
            if (typeof data !== "string") {
                data = JSON.stringify(data);
            }
            msg = `${cmd}|${data}`;
        } else {
            msg = cmd;
        }
        this.dbg("->", msg);
        return this.ws.send(msg);
    }
}

export { Websocket };
