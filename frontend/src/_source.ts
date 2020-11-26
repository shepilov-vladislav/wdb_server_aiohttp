import { Log } from "./_base";
import { CodeMirror } from "./_codemirror";
import "./scss/_source.scss";

class Source extends Log {
    public wdb: any;
    public $container: JQuery;
    public code_mirror: CodeMirror;
    public $code_mirror: JQuery;
    public state: any;
    public fun_scope: any;
    public footsteps: any;
    public breakpoints: any;

    constructor(wdb: any) {
        super();
        this.wdb = wdb;
        this.$container = $(".source")
            .on("mousedown", (e) => {
                if (e.which !== 2 || !this.code_mirror.getOption("readOnly")) {
                    return;
                }
                return this.code_mirror.setOption("readOnly", "nocursor");
            })
            .on("mouseup", (e) => {
                if (e.which !== 2) {
                    return;
                } // Middle
                this.code_mirror.setOption("readOnly", true);
                return this.wdb.paste_target(e);
            });

        this.code_mirror = CodeMirror(
            (elt: any) => {
                this.$code_mirror = $(elt);
                return this.$container.prepend(elt);
            },
            {
                value: "No active file",
                theme: "material",
                readOnly: true,
                gutters: ["breaks", "CodeMirror-linenumbers"],
                lineNumbers: true,
                extraKeys: {
                    Esc: this.stop_edition.bind(this),
                    "Ctrl-S": this.save.bind(this),
                },
            }
        );

        this.code_mirror.on("gutterClick", this.gutter_click.bind(this));
        $(window).on("resize", this.size.bind(this));
        this.state = {
            fn: null,
            file: null,
            fun: null,
            lno: 0,
        };

        this.fun_scope = null;
        // File -> footsteps
        this.footsteps = {};
        this.breakpoints = {};
    }

    external(full: any) {
        if (full == null) {
            full = true;
        }
        const cursor = this.code_mirror.getCursor();
        let fn = `${this.state.fn}`;
        if (full) {
            fn = `${fn}:${cursor.line + 1}:${cursor.ch + 1}`;
        }
        return this.wdb.ws.send("External", fn);
    }

    save() {
        if (this.code_mirror.getOption("readOnly")) {
            return;
        }
        const new_file = this.code_mirror.getValue();
        this.wdb.ws.send("Save", `${this.state.fn}|${new_file}`);
        return (this.state.file = new_file);
    }

    gutter_click(_: any, n?: any) {
        return this.wdb.toggle_break(`:${n + 1}`);
    }

    clear_breakpoint(brk: any) {
        if (this.breakpoints[brk.fn] == null) {
            this.breakpoints[brk.fn] = [];
        }
        if (Array.from(this.breakpoints[brk.fn]).includes(brk)) {
            this.breakpoints[brk.fn].splice(
                this.breakpoints[brk.fn].indexOf(brk)
            );
        }

        if (brk.lno) {
            this.remove_mark(brk.lno);
            this.remove_class(brk.lno, "ask-breakpoint");
            return this.remove_class(brk.lno, "breakpoint");
        }
    }

    ask_breakpoint(lno: any) {
        return this.add_class(lno, "ask-breakpoint");
    }

    set_breakpoint(brk: any) {
        if (this.breakpoints[brk.fn] == null) {
            this.breakpoints[brk.fn] = [];
        }
        this.breakpoints[brk.fn].push(brk);
        return this.mark_breakpoint(brk);
    }

    mark_breakpoint(brk: any) {
        if (brk.lno) {
            this.remove_class(brk.lno, "ask-breakpoint");
            this.add_class(brk.lno, "breakpoint");
            return this.add_mark(
                brk.lno,
                "breakpoint",
                "breaks",
                brk.temporary ? "○" : "●",
                this.brk_to_str(brk)
            );
        }
    }

    brk_to_str(brk: any) {
        let str;
        if (brk.temporary) {
            str = "Temporary ";
        } else {
            str = "";
        }

        str += "Breakpoint";

        if (brk.fun) {
            str += ` On ${brk.fun}`;
        }

        if (brk.lno) {
            str += ` At ${brk.lno}`;
        }

        if (brk.cond) {
            str += ` If ${brk.cond}`;
        }

        return str;
    }

    get_selection() {
        return this.code_mirror.getSelection().trim();
    }

    get_breakpoint(n: any) {
        if (this.breakpoints[this.state.fn] == null) {
            this.breakpoints[this.state.fn] = [];
        }
        for (let brk of Array.from(this.breakpoints[this.state.fn]) as any) {
            if (brk.lno === n) {
                return brk;
            }
        }
    }

    add_class(lno: any, cls: any) {
        return this.code_mirror.addLineClass(lno - 1, "background", cls);
    }

    remove_class(lno: any, cls: any) {
        return this.code_mirror.removeLineClass(lno - 1, "background", cls);
    }

    add_mark(lno: any, cls: any, id: any, char: any, title?: any) {
        return this.code_mirror.setGutterMarker(
            lno - 1,
            id,
            $("<div>", { class: cls, title }).html(char).get(0)
        );
    }

    remove_mark(lno: any) {
        return this.code_mirror.setGutterMarker(lno - 1, "breaks", null);
    }

    stop_edition() {
        if (!this.code_mirror.getOption("readOnly")) {
            return this.toggle_edition();
        }
    }

    toggle_edition() {
        const was_ro = this.code_mirror.getOption("readOnly");
        this.code_mirror.setOption("readOnly", !was_ro);
        this.$code_mirror.toggleClass("rw");
        document.querySelector(".el").classList.toggle("class");

        this.wdb.print({
            for: "Toggling edition",
            result: `Edit mode ${was_ro ? "on" : "off"}`,
        });

        if (!was_ro) {
            return this.code_mirror.setValue(this.state.file);
        }
    }

    open(data: any, frame: any) {
        const new_state = {
            fn: data.name,
            file: data.file || frame.code,
            fun: frame.function,
            lno: frame.lno,
            flno: frame.flno,
            llno: frame.llno,
        };
        return this.set_state(new_state);
    }

    set_state(new_state: any) {
        let lno;
        let rescope = true;

        if (
            this.state.fn !== new_state.fn ||
            this.state.file !== new_state.file
        ) {
            this.code_mirror.setOption("mode", this.get_mode(new_state.fn));
            this.code_mirror.setValue(new_state.file);
            for (let brk of Array.from(this.breakpoints[new_state.fn] || [])) {
                this.mark_breakpoint(brk);
            }
        } else {
            if (this.state.fun !== new_state.fun) {
                if (this.state.fun !== "<module>") {
                    let asc, end;
                    this.remove_class(this.state.flno, "ctx-top");
                    for (
                        lno = this.state.flno,
                            end = this.state.llno,
                            asc = this.state.flno <= end;
                        asc ? lno <= end : lno >= end;
                        asc ? lno++ : lno--
                    ) {
                        this.remove_class(lno, "ctx");
                    }
                    this.remove_class(this.state.llno, "ctx-bottom");
                }
            } else {
                rescope = false;
            }
        }

        this.state = new_state;

        this.code_mirror.clearGutter("CodeMirror-linenumbers");
        for (let step of Array.from(this.footsteps[this.state.fn] || [])) {
            this.remove_class(step, "highlighted");
            this.add_class(step, "footstep");
        }

        if (rescope && this.state.fun !== "<module>") {
            let asc1, end1;
            this.add_class(this.state.flno, "ctx-top");
            for (
                lno = this.state.flno,
                    end1 = this.state.llno,
                    asc1 = this.state.flno <= end1;
                asc1 ? lno <= end1 : lno >= end1;
                asc1 ? lno++ : lno--
            ) {
                this.add_class(lno, "ctx");
            }
            this.add_class(this.state.llno, "ctx-bottom");
        }

        this.add_class(this.state.lno, "highlighted");
        this.add_mark(
            this.state.lno,
            "highlighted",
            "CodeMirror-linenumbers",
            "➤"
        );
        if (this.footsteps[this.state.fn] == null) {
            this.footsteps[this.state.fn] = [];
        }
        this.footsteps[this.state.fn].push(this.state.lno);

        this.code_mirror.scrollIntoView(
            {
                line: this.state.lno,
                ch: 1,
            },
            this.$code_mirror.height() / 2
        );
        return this.code_mirror.refresh();
    }

    get_mode(fn: any) {
        switch (fn.split(".").splice(-1)[0]) {
            case "py":
                return "python";
            case "jinja2":
                return "jinja2";
            case "diff":
                return "diff";
            default:
                return "python";
        }
    }

    focused() {
        return this.$code_mirror.hasClass("CodeMirror-focused");
    }

    size() {
        this.$code_mirror.height(0);
        this.$code_mirror.height(this.$container.height());
        return this.code_mirror.refresh();
    }
}

export { Source };
