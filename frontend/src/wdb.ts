import "material-design-lite/material";
import "typeface-roboto/index.css";
import "typeface-roboto-mono/index.css";
// @ts-ignore
import * as dialogPolyfill from "dialog-polyfill/dist/dialog-polyfill";
import { Log } from "./_base";
import { Websocket } from "./_websocket";
import { Traceback } from "./_traceback";
import { Source } from "./_source";
import { Interpreter } from "./_interpreter";
import { Prompt } from "./_prompt";
import { Switch } from "./_switch";
import { Watchers } from "./_watchers";
import { help } from "./_help";
import { CodeMirror } from "./_codemirror";
import "./scss/wdb.scss";

export class Wdb extends Log {
    public prototype: any;
    public started: any;
    public cwd: any;
    public file_cache: any;
    public last_cmd: any;
    public evalTime: any;
    public ws: any;
    public traceback: any;
    public source: any;
    public interpreter: any;
    public prompt: any;
    public switch: any;
    public watchers: any;
    public $patience: any;
    public nodeType: any;
    public nodeValue: any;
    public parentElement: any;
    public __version__: string;

    static initClass() {
        this.prototype.__version__ = "1.1.0-dev1";
    }

    constructor() {
        super();
        this.started = false;
        this.cwd = null;
        this.file_cache = {};
        this.last_cmd = null;
        this.evalTime = null;

        this.ws = new Websocket(this, $("[data-uuid]").attr("data-uuid"));
        this.traceback = new Traceback(this);
        this.source = new Source(this);
        this.interpreter = new Interpreter(this);
        this.prompt = new Prompt(this);
        this.switch = new Switch(this);
        this.watchers = new Watchers(this);

        this.$patience = $(".patience");
        // Prevent locking of monothread
        $(window).on("beforeunload", this.unload.bind(this));
    }

    opening() {
        // Start by getting current trace
        if (!this.started) {
            $(window).on("keydown", this.global_key.bind(this));
            this.started = true;
        }

        this.ws.send("Start");
        return this.switch.open_term();
    }

    working() {
        return $("body,.activity").addClass("is-active");
    }

    chilling() {
        return $("body,.activity").removeClass("is-active");
    }

    done() {
        this.interpreter.scroll();
        this.prompt.ready();
        return this.chilling();
    }

    init(data: any) {
        if (data.version !== this.constructor.prototype.__version__) {
            this.print({
                for: "Client Server version mismatch !",
                result: `Server is ${
                    this.constructor.prototype.__version__
                } and \
Client is ${data.version || "<= 2.0"}`,
            });
        }

        this.cwd = data.cwd;
        const brks = data.breaks;
        return (() => {
            const result = [];
            for (let brk of Array.from(brks) as any) {
                if (this.source.breakpoints[brk.fn] == null) {
                    this.source.breakpoints[brk.fn] = [];
                }
                result.push(this.source.breakpoints[brk.fn].push(brk));
            }
            return result;
        })();
    }

    title(data: any) {
        $(".title").text(data.title).attr("title", data.title);

        return $(".subtitle").text(data.subtitle).attr("title", data.subtitle);
    }

    trace(data: any) {
        this.switch.open_trace();
        return this.traceback.make_trace(data.trace);
    }

    select_trace(level: any) {
        return this.ws.send("Select", level);
    }

    selectcheck(data: any) {
        if (!(data.name in this.file_cache)) {
            return this.ws.send("File", data.name);
        } else {
            data.file = this.file_cache[data.name];
            return this.select(data);
        }
    }

    select(data: any) {
        const current_frame = data.frame;
        this.switch.open_code();
        $(".trace-line").removeClass("selected");
        $(".trace-" + current_frame.level).addClass("selected");
        this.file_cache[data.name] = data.file;
        this.source.open(data, current_frame);
        return this.done();
    }

    ellipsize($code: any) {
        return $code.find("span.cm-string").each(function () {
            const txt = $(this).text();
            if (txt.length > 128) {
                $(this).text("");
                $(this).append(
                    $('<span class="short close">').text(txt.substr(0, 128))
                );
                return $(this).append(
                    $('<span class="long">').text(txt.substr(128))
                );
            }
        });
    }

    code(
        parent: any,
        src: any,
        classes: any,
        html?: any,
        title: any = null,
        mode?: any
    ) {
        let $code;
        if (classes == null) {
            classes = [];
        }
        if (html == null) {
            html = false;
        }
        if (mode == null) {
            mode = "python";
        }
        if (html) {
            let $node;
            if (src[0] !== "<" || src.slice(-1) !== ">") {
                $node = $("<div>", { class: "out" }).html(src);
            } else {
                $node = $(src);
            }
            parent.append($node);
            $node
                .add($node.find("*"))
                .contents()
                .filter(function () {
                    return (
                        this.nodeType === 3 &&
                        this.nodeValue.length > 0 &&
                        !$(this.parentElement).closest("thead").length
                    );
                })
                .wrap("<code>")
                .parent()
                // @ts-ignore
                .each((i: any, elt: any) => {
                    const $code = $(elt);
                    $code.addClass("waiting_for_hl").addClass("cm-s-default");
                    for (let cls of Array.from(classes) as any) {
                        $code.addClass(cls);
                    }
                    if (title) {
                        $code.attr("title", title);
                    }
                    return setTimeout(() => {
                        CodeMirror.runMode($code.text(), mode, $code.get(0));
                        $code.removeClass("waiting_for_hl");
                        return this.ellipsize($code);
                    }, 50);
                });
        } else {
            $code = $("<code>", { class: "cm-s-default" });
            for (let cls of Array.from(classes) as any) {
                $code.addClass(cls);
            }
            if (title) {
                $code.attr("title", title);
            }
            parent.append($code);
            CodeMirror.runMode(src, mode, $code.get(0));
            this.ellipsize($code);
        }

        return $code;
    }

    execute(snippet: any) {
        const cmd = function () {
            this.ws.send.apply(this.ws, arguments);
            this.last_cmd = arguments;
            return this.working();
        }.bind(this);

        if (snippet.indexOf(".") === 0) {
            let data, key;
            const space = snippet.indexOf(" ");
            if (space > -1) {
                key = snippet.substr(1, space - 1);
                data = snippet.substr(space + 1);
            } else {
                key = snippet.substr(1);
                data = "";
            }
            const sent = (() => {
                switch (key) {
                    case "a":
                        return this.printHistory();
                    case "b":
                        return this.toggle_break(data);
                    case "c":
                        return cmd("Continue");
                    case "d":
                        if (data) {
                            return cmd("Dump", data);
                        }
                        break;
                    case "e":
                        return this.source.toggle_edition();
                    case "f":
                        if (data) {
                            return cmd("Find", data);
                        }
                        break;
                    case "g":
                        return this.cls();
                    case "h":
                        return this.printHelp();
                    case "i":
                        if (data) {
                            return cmd("Display", data);
                        }
                        break;
                    case "j":
                        if (data) {
                            return cmd("Jump", data);
                        }
                        break;
                    case "k":
                        return this.clearHistory();
                    case "l":
                        return cmd("Breakpoints");
                    case "m":
                        return cmd("Restart");
                    case "n":
                        return cmd("Next");
                    case "o":
                        return this.source.external(!data);
                    case "q":
                        return cmd("Quit");
                    case "r":
                        return cmd("Return");
                    case "s":
                        return cmd("Step");
                    case "t":
                        return this.toggle_break(data, true);
                    case "u":
                        return cmd("Until");
                    case "w":
                        if (data) {
                            return cmd("Watch", data);
                        }
                        break;
                    case "x":
                        if (data) {
                            return cmd("Diff", data);
                        }
                        break;
                    case "z":
                        return this.toggle_break(data, false, true);
                }
            })();

            if (!sent) {
                this.prompt.unlock();
            }
            return;
        } else if (snippet.indexOf("?") === 0) {
            cmd("Dump", snippet.slice(1).trim());
            return;
        } else if (snippet === "" && this.last_cmd) {
            cmd.apply(this, this.last_cmd);
            return;
        }
        if (snippet) {
            this.working();
            this.ws.send("Eval", snippet);
            this.evalTime =
                typeof performance !== "undefined" && performance !== null
                    ? performance.now()
                    : undefined;
            this.$patience.text(this.pretty_time(0));
            var raf = () => {
                if (!this.evalTime) {
                    this.$patience.text("");
                    return;
                }
                const duration = parseInt(
                    // @ts-ignore
                    (performance.now() - this.evalTime) * 1000
                );
                this.$patience.text(this.pretty_time(duration));
                return requestAnimationFrame(raf);
            };
            return requestAnimationFrame(raf);
        }
    }

    cls() {
        this.interpreter.clear();
        return this.done();
    }

    printHistory(hist?: any) {
        return this.print({
            for: "History",
            result: this.prompt.history
                .getSessionHistory()
                .reverse()
                .filter((e: any) => e.indexOf(".") !== 0)
                .join("\n"),
        });
    }

    clearHistory() {
        return this.prompt.history.clear();
    }

    printHelp() {
        this.dialog("Help", help);
        return this.done();
    }

    print(data: any) {
        let $timeholder: any, duration: number, print_start: any;
        if (this.evalTime) {
            // @ts-ignore
            duration = parseInt((performance.now() - this.evalTime) * 1000);
            print_start = performance.now();
            this.evalTime = null;
        }

        const $group = $("<div>", { class: "printed scroll-line" });
        this.interpreter.write($group);

        $group.append(($timeholder = $("<div>")));
        this.code($group, data.for, ["for prompted"]);
        const $result = $("<div>", { class: "result" });
        $group.append($result);
        this.code($result, data.result || " ", ["val"], true);

        const print_duration: number = parseInt(
            // @ts-ignore
            (performance.now() - print_start) * 1000
        );
        if (data.duration) {
            this.code(
                $timeholder,
                this.pretty_time(data.duration),
                ["duration"],
                false,
                `Total ${this.pretty_time(duration)} + ${this.pretty_time(
                    print_duration
                )} of rendering`
            );
        }

        return this.done();
    }

    echo(data: any) {
        const $group = $("<div>", { class: "echoed scroll-line" });
        this.interpreter.write($group);
        this.code($group, data.for, ["for prompted"]);
        const $result = $("<div>", { class: "result" });
        $group.append($result);
        this.code($result, data.val || "", ["val"], true, null, data.mode);
        return this.done();
    }

    rawhtml(data: any) {
        const $group = $("<div>", { class: "rawhtml scroll-line" });
        this.interpreter.write($group);
        this.code($group, data.for, ["for prompted"]);
        this.interpreter.write(data.val);
        return this.done();
    }

    dump(data: any) {
        const $group = $("<div>", { class: "dump scroll-line" });
        this.interpreter.write($group);
        this.code($group, data.for, ["for prompted"]);

        const $container = $("<div>");
        const $table = $("<table>", {
            class: `mdl-data-table mdl-js-data-table \
mdl-shadow--2dp object`,
        }).appendTo($container);
        const $core_head = $("<thead>", { class: "toggle closed" })
            .append(
                $("<tr>").append(
                    $("<th>", { class: "core", colspan: 2 }).text(
                        "Core Members"
                    )
                )
            )
            .appendTo($table);
        const $core_tbody = $("<tbody>", { class: "core closed" }).appendTo(
            $table
        );

        const $method_head = $("<thead>", { class: "toggle closed" })
            .append(
                $("<tr>").append(
                    $("<th>", { class: "method", colspan: 2 }).text("Methods")
                )
            )
            .appendTo($table);
        const $method_tbody = $("<tbody>", { class: "method closed" }).appendTo(
            $table
        );

        const $attr_head = $("<thead>", { class: "toggle closed" })
            .append(
                $("<tr>").append(
                    $("<th>", { class: "attr", colspan: 2 }).text("Attributes")
                )
            )
            .appendTo($table);
        const $attr_tbody = $("<tbody>", { class: "attr closed" }).appendTo(
            $table
        );

        for (let key in data.val) {
            const val = data.val[key];
            let $tbody = $attr_tbody;
            if (
                key.indexOf("__") === 0 &&
                key.indexOf("__", key.length - 2) !== -1
            ) {
                $tbody = $core_tbody;
            } else if (val.type.indexOf("method") !== -1) {
                $tbody = $method_tbody;
            }

            $tbody.append(
                $("<tr>")
                    .append($("<td>", { class: "key" }).text(key))
                    .append(
                        $("<td>", {
                            class: "mdl-data-table__cell--non-numeric val",
                        }).html(val.val)
                    )
            );
        }

        if ($core_tbody.find("tr").length === 0) {
            $core_head.remove();
            $core_tbody.remove();
        }

        if ($attr_tbody.find("tr").length === 0) {
            $attr_head.remove();
            $attr_tbody.remove();
        }

        if ($method_tbody.find("tr").length === 0) {
            $method_head.remove();
            $method_tbody.remove();
        }

        if (data.doc) {
            $table.append(
                $("<thead>", { class: "toggle closed" }).append(
                    $("<tr>").append(
                        $("<th>", { class: "doc", colspan: 2 }).text(
                            "Documentation"
                        )
                    )
                )
            );

            $("<tbody>", { class: "doc closed" })
                .append(
                    $("<tr>").append(
                        $("<td>", {
                            class: "mdl-data-table__cell--non-numeric doc",
                            colspan: 2,
                        }).text(data.doc)
                    )
                )
                .appendTo($table);
        }

        if (data.source) {
            $table.append(
                $("<thead>", { class: "toggle closed" }).append(
                    $("<tr>").append(
                        $("<th>", { class: "source", colspan: 2 }).text(
                            "Source"
                        )
                    )
                )
            );

            $("<tbody>", { class: "source closed" })
                .append(
                    $("<tr>").append(
                        $("<td>", {
                            class: "mdl-data-table__cell--non-numeric source",
                            colspan: 2,
                        }).text(data.source)
                    )
                )
                .appendTo($table);
        }

        window.componentHandler.upgradeElement($table.get(0));
        this.code($group, $container.html(), [], true);
        return this.done();
    }

    breakset(data: any) {
        let needle;
        this.source.set_breakpoint(data);

        if (
            this.prompt.get()[0] === "." &&
            ((needle = this.prompt.get()[1]), ["b", "t"].includes(needle))
        ) {
            return this.done();
        } else {
            return this.chilling();
        }
    }

    breakunset(data: any) {
        let needle;
        this.source.clear_breakpoint(data);

        if (
            this.prompt.get()[0] === "." &&
            ((needle = this.prompt.get()[1]), ["b", "t", "z"].includes(needle))
        ) {
            return this.done();
        } else {
            return this.chilling();
        }
    }

    split(str: any, char: any) {
        // Returns the split on last occurence of char
        if (Array.from(str).includes(char)) {
            const split = str.split(char);
            return [split[0], split.slice(1).join(char).trim()];
        } else {
            return [str, null];
        }
    }

    toggle_break(arg: any, temporary?: any, remove_only?: any) {
        let cmd;
        if (temporary == null) {
            temporary = false;
        }
        if (remove_only == null) {
            remove_only = false;
        }
        let brk = {
            lno: null,
            cond: null,
            fun: null,
            fn: null,
            temporary,
        } as any;

        let remaining = arg;

        [remaining, brk.cond] = Array.from(this.split(remaining, ","));
        [remaining, brk.fun] = Array.from(this.split(remaining, "#"));
        [remaining, brk.lno] = Array.from(this.split(remaining, ":"));
        brk.fn = remaining || this.source.state.fn;
        brk.lno = parseInt(brk.lno) || null;

        let exist = false;
        for (let ebrk of Array.from(
            this.source.breakpoints[brk.fn] || []
        ) as any) {
            if (
                ebrk.fn === brk.fn &&
                ebrk.lno === brk.lno &&
                ebrk.cond === brk.cond &&
                ebrk.fun === brk.fun &&
                (ebrk.temporary === brk.temporary || remove_only)
            ) {
                exist = true;
                brk = ebrk;
                break;
            }
        }

        if (exist || remove_only) {
            this.source.clear_breakpoint(brk);
            cmd = "Unbreak";
            if (!brk.temporary) {
                cmd = "Broadcast|" + cmd;
            }
            this.ws.send(cmd, brk);
            this.working();
            return;
        }

        if (brk.lno) {
            this.source.ask_breakpoint(brk.lno);
        }
        cmd = "Break";
        if (!temporary) {
            cmd = "Broadcast|" + cmd;
        }
        this.ws.send(cmd, brk);
        return this.working();
    }

    watched(data: any) {
        return this.watchers.updateAll(data);
    }
    // No @done() here

    ack() {
        return this.done();
    }

    display(data: any) {
        let $tag;
        const $group = $("<div>", { class: "display scroll-line" });
        this.interpreter.write($group);
        this.code($group, data.for, ["for prompted"]);
        if (data.type.indexOf("image") >= 0) {
            $tag = $("<img>");
        } else if (data.type.indexOf("audio") >= 0) {
            $tag = $("<audio>", { controls: "controls", autoplay: "autoplay" });
        } else if (
            data.type.indexOf("video") >= 0 ||
            data.type.indexOf("/ogg") >= 0
        ) {
            $tag = $("<video>", { controls: "controls", autoplay: "autoplay" });
        } else {
            $tag = $("<iframe>");
        }

        $tag.addClass("display");
        $tag.attr("src", `data:${data.type};charset=UTF-8;base64,${data.val}`);
        $group.append($tag);
        return this.done();
    }

    suggest(data: any) {
        if (data) {
            return this.prompt.complete(data);
        }
    }

    die() {
        this.title({ title: "Dead", subtitle: "Program has exited" });
        this.ws.ws.close();
        $("body").addClass("is-dead");
        if (!$("body").attr("data-debug")) {
            return setTimeout(() => window.close(), 10);
        }
    }

    global_key(e: any) {
        if (this.source.rw) {
            return true;
        }
        const sel =
            this.source.focused() && this.source.code_mirror.getSelection();

        if (
            (e.altKey &&
                ((65 <= e.keyCode && e.keyCode <= 90) ||
                    (37 <= e.keyCode && e.keyCode <= 40) ||
                    e.keyCode === 13)) ||
            (118 <= e.keyCode && e.keyCode <= 122)
        ) {
            let char = (() => {
                switch (e.keyCode) {
                    case 37:
                    case 118:
                        return "u"; // <     / F7
                    case 13:
                    case 119:
                        return "c"; // Enter / F8
                    case 38:
                    case 120:
                        return "r"; // ^     / F9
                    case 39:
                    case 121:
                        return "n"; // >     / F10
                    case 40:
                    case 122:
                        return "s"; // v     / F11
                    default:
                        return String.fromCharCode(e.keyCode);
                }
            })();
            char = char.toLowerCase();
            let extra = "";
            // Break on current line
            if (["b", "t", "z"].includes(char)) {
                extra += " :" + this.source.state.lno;
            }
            if (char === "i") {
                extra = " " + sel;
            }
            if (char === "o" && e.shiftKey) {
                extra = " !";
            }

            this.execute("." + char + extra);
            return false;
        }

        if (e.keyCode === 13) {
            if (this.prompt.focused()) {
                return;
            }
            if (!sel) {
                return;
            }

            if (e.shiftKey) {
                this.prompt.insert(sel);
                this.prompt.focus();
            } else if (e.ctrlKey) {
                this.ws.send("Watch", sel);
            } else {
                this.prompt.history.historize(sel);
                this.execute(sel);
            }
            return false;
        }
    }

    newline() {
        this.prompt.ready(true);
        return this.chilling();
    }

    inspect(id: any) {
        this.ws.send("Inspect", id);
        this.working();
        return false;
    }

    unwatch(expr: any) {
        this.ws.send("Unwatch", expr);
        return this.working();
    }

    paste_target(e: any) {
        const target = $(e.target).text().trim();
        if (target === "") {
            return true;
        }
        if (e.shiftKey) {
            this.prompt.insert(target);
            return;
        }
        if (e.ctrlKey) {
            this.ws.send("Watch", target);
            return;
        }
        this.prompt.history.historize(target);
        this.ws.send("Dump", target);
        this.working();
        return false;
    }

    disable() {
        return this.ws.send("Disable");
    }

    shell() {
        this.switch.close_trace();
        this.switch.close_code();
        this.switch.open_term();
        return this.done();
    }

    dialog(title: any, content: any) {
        let $dialog: any;
        $(".modals").append(
            ($dialog = $(`\
<dialog class="mdl-dialog">
  <h3 class="mdl-dialog__title">${title}</h3>
  <div class="mdl-dialog__content">
    ${content}
  </div>
  <div class="mdl-dialog__actions">
    <button type="button" class="mdl-button dialog-close">Close</button>
  </div>
</dialog>\
`))
        );
        $dialog.find(".dialog-close").on("click", function () {
            $dialog.get(0).close();
            return $dialog.remove();
        });

        $dialog.find(".mdl-tabs,.mdl-data-table").each(function () {
            return window.componentHandler.upgradeElement(this);
        });
        $dialog.on("close", () => {
            return this.prompt.ready();
        });

        const dialog = $dialog.get(0);
        dialogPolyfill.registerDialog(dialog);
        return dialog.showModal();
    }

    pretty_time(time: number) {
        if (time < 1000) {
            return `${time}μs`;
        }

        time = time / 1000;
        if (time < 10) {
            return `${time.toFixed(2)}ms`;
        }
        if (time < 100) {
            return `${time.toFixed(1)}ms`;
        }
        if (time < 1000) {
            return `${time.toFixed(0)}ms`;
        }

        time = time / 1000;
        if (time < 10) {
            return `${time.toFixed(2)}s`;
        }
        if (time < 60) {
            return `${time.toFixed(1)}s`;
        }

        const with_zero = function (s: any) {
            s = s.toString();
            if (s.length === 1) {
                return `0${s}`;
            }
            return s;
        };

        let mtime = Math.floor(time / 60);
        const stime = (time - 60 * mtime).toFixed(0);

        if (mtime < 60) {
            return `${mtime}m${with_zero(stime)}s`;
        }

        const htime = Math.floor(mtime / 60);
        mtime = mtime - 60 * htime;
        return `${htime}h${with_zero(mtime.toFixed(0))}m${with_zero(stime)}s`;
    }

    unload() {
        return this.ws.ws.close();
    }
}
Wdb.initClass();

declare global {
    interface Window {
        wdb: Wdb;
        componentHandler: any;
    }
}

$(() => (window.wdb = new Wdb()));
