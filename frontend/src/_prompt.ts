import { Log } from "./_base";
import { History } from "./_history";
import { CodeMirror } from "./_codemirror";
import { Wdb } from "./wdb";
import "./scss/_prompt.scss";

class Prompt extends Log {
    public wdb: Wdb;
    public $container: JQuery;
    public history: any;
    public code_mirror: CodeMirror;
    public $code_mirror: JQuery;
    public completion: any;
    public cur: any;
    public tok: any;

    constructor(wdb: any) {
        super();
        this.wdb = wdb;
        this.$container = $(".prompt");
        this.history = new History(this);

        this.code_mirror = CodeMirror(
            (elt: any) => {
                this.$code_mirror = $(elt);
                return this.$container.prepend(elt);
            },
            {
                value: "",
                theme: "default",
                language: "python",
                viewportMargin: Infinity,
                lineWrapping: true,
                autofocus: true,
                // Add nbsp
                specialChars: /[\u0000-\u0019\u00a0\u00ad\u200b-\u200f\u2028\u2029\ufeff]/,
            }
        );

        this.code_mirror.on("changes", this.changes.bind(this));

        CodeMirror.registerHelper(
            "hint",
            "jedi",
            (cm: any, callback: any, options: any) => {
                let cur;
                cur = cm.getCursor();
                const tok = cm.getTokenAt(cur);
                if (
                    cm.getValue().startsWith(".") &&
                    cm.getValue().length === 2
                ) {
                    return;
                }
                const from = CodeMirror.Pos(cur.line, tok.start);
                const to = CodeMirror.Pos(cur.line, tok.end);
                if (cm.getValue() === ".") {
                    callback({
                        from,
                        to,
                        list: (() => {
                            const result = [];
                            const object = {
                                a: "History",
                                b: "Break",
                                c: "Continue",
                                d: "Dump",
                                e: "Edition",
                                f: "Find",
                                g: "Clear",
                                h: "Help",
                                i: "Display",
                                j: "Jump",
                                k: "Clear",
                                l: "Breakpoints",
                                m: "Restart",
                                n: "Next",
                                o: "Open",
                                q: "Quit",
                                r: "Return",
                                s: "Step",
                                t: "Tbreak",
                                u: "Until",
                                w: "Watch",
                                x: "Diff",
                                z: "Unbreak",
                            } as any;
                            for (let key of Object.keys(object || {})) {
                                const help = object[key];
                                result.push({
                                    text: "." + key,
                                    displayText: `.${key} <i>${this.leftpad(
                                        "(" + help + ")",
                                        14
                                    )}</i>  `,
                                    render(elt: any, data: any, cur: any) {
                                        return $(elt).html(cur.displayText);
                                    },
                                });
                            }
                            return result;
                        })(),
                    });
                    return;
                }

                if (!options.completeSingle) {
                    // Auto triggered
                    if (!tok.string.match(/[\w\.\(\[\{]/)) {
                        return;
                    }
                }

                this.wdb.ws.send("Complete", {
                    source: cm.getValue(),
                    pos: this.code_mirror.getRange({ line: 0, ch: 0 }, cur)
                        .length,
                    line: cur.line + 1,
                    column: cur.ch,
                    manual: options.completeSingle,
                });

                return (this.completion = {
                    cur,
                    tok,
                    from,
                    to,
                    callback,
                });
            }
        );

        this.code_mirror.addKeyMap({
            Enter: this.newLineOrExecute.bind(this),
            Up: this.history.up.bind(this.history),
            Down: this.history.down.bind(this.history),
            "Ctrl-C": this.abort.bind(this),
            "Ctrl-D": () => {
                if (!this.get()) {
                    return this.wdb.die();
                }
            },
            "Ctrl-F"() {},
            "Ctrl-R": () => this.searchBack(),
            "Ctrl-S": () => this.searchBack(false),
            "Ctrl-K": "killLine",
            "Ctrl-L": this.wdb.cls.bind(this.wdb),
            "Ctrl-Enter": "newlineAndIndent",
            "Alt-Backspace": "delGroupBefore",
            "Ctrl-Space": this.triggerAutocomplete.bind(this),
            "Ctrl-Up": () => this.insertHistory("up"),
            "Ctrl-Down": () => this.insertHistory("down"),
            // Use page up/down for going up/down in multiline
            PageUp: "goLineUp",
            PageDown: "goLineDown",
            "Shift-PageUp": () => {
                return this.wdb.interpreter.scroll(-1);
            },
            "Shift-PageDown": () => {
                return this.wdb.interpreter.scroll(1);
            },
            Tab: (cm: any, options: any) => {
                const cur = this.code_mirror.getCursor();
                const rng = this.code_mirror.getRange(
                    { line: cur.line, ch: 0 },
                    cur
                );
                if (rng.trim()) {
                    return this.triggerAutocomplete(cm, options);
                } else {
                    const spaces = Array(
                        this.code_mirror.getOption("indentUnit") + 1
                    ).join(" ");
                    return this.code_mirror.replaceSelection(spaces);
                }
            },
        });

        this.code_mirror.on("keyup", (cm: any, e: any) => {
            if (!cm.getValue()) {
                return;
            }
            if (8 < e.keyCode && e.keyCode < 42) {
                return;
            }
            return CodeMirror.commands.autocomplete(cm, CodeMirror.hint.jedi, {
                async: true,
                completeSingle: false,
                // If auto hint restore these defaults
                extraKeys: {
                    PageUp: "goPageUp",
                    PageDown: "goPageDown",
                    Home: "goLineStartSmart",
                    Up(cm: any, handle: any) {
                        handle._dirty = true;
                        return handle.moveFocus(-1);
                    },
                    Down(cm: any, handle: any) {
                        handle._dirty = true;
                        return handle.moveFocus(1);
                    },
                    Enter: (cm: any, handle: any) => {
                        if (handle._dirty) {
                            return handle.pick();
                        } else {
                            return this.newLineOrExecute(cm);
                        }
                    },
                    Right(cm: any, handle: any) {
                        if (handle._dirty) {
                            return handle.pick();
                        } else {
                            return CodeMirror.commands.goCharRight(cm);
                        }
                    },
                    End: "goLineEnd",
                },
            });
        });
    }

    complete(data: any) {
        if (data.completions && this.completion) {
            const { cur } = this.completion;
            const { tok } = this.completion;
            const hints = {
                from: CodeMirror.Pos(cur.line, tok.start),
                to: CodeMirror.Pos(cur.line, tok.end),
                list: Array.from(data.completions).map((completion: any) => ({
                    text: completion.base + completion.complete,
                    from: CodeMirror.Pos(
                        cur.line,
                        cur.ch - completion.base.length
                    ),
                    to: cur,
                    _completion: completion,
                    render(elt: any, data: any, cur: any) {
                        const c = cur._completion;
                        const item = `<b>${c.base}</b>${c.complete}`;
                        return $(elt).html(item);
                    },
                })),
            };
            CodeMirror.on(hints, "shown", () => {
                let cls;
                if (
                    this.code_mirror.state.completionActive.options
                        .completeSingle
                ) {
                    cls = "triggered";
                } else {
                    cls = "auto";
                }
                return $(
                    this.code_mirror.state.completionActive.widget.hints
                ).addClass(cls);
            });

            this.completion.callback(hints);
            return;
        }

        if (data.imports) {
            return CodeMirror.commands.autocomplete(
                this.code_mirror,
                (cm: any, options: any) => ({
                    from: CodeMirror.Pos(0, 0),
                    to: CodeMirror.Pos(0, 0),

                    list: Array.from(data.imports).map((imp) => ({
                        text: imp,
                        from: CodeMirror.Pos(0, 0),
                        to: CodeMirror.Pos(0, 0),
                        render(elt: any, data: any, cur: any) {
                            const item = `<em>${cur.text}</em>`;
                            return $(elt).html(item);
                        },
                    })),
                }),
                {
                    async: false,
                    completeSingle: false,
                }
            );
        }
    }

    triggerAutocomplete(cm: any, options?: any) {
        return CodeMirror.commands.autocomplete(cm, CodeMirror.hint.jedi, {
            async: true,
            extraKeys: {
                Right(cm: any, handle: any) {
                    return handle.pick();
                },
            },
        });
    }

    newLineOrExecute(cm: any) {
        const snippet = cm.getValue().trim();
        if (!snippet) {
            return;
        }
        cm.setOption("readOnly", "nocursor");
        this.$container.addClass("loading");
        return this.wdb.execute(snippet);
    }

    focus() {
        return this.code_mirror.focus();
    }

    focused() {
        return this.$code_mirror.hasClass("CodeMirror-focused");
    }

    abort() {
        this.history.reset();
        return this.set("");
    }

    ready(newline: any) {
        if (newline == null) {
            newline = false;
        }
        if (newline) {
            this.code_mirror.execCommand("newlineAndIndent");
        } else {
            const snippet = this.code_mirror.getValue().trim();
            this.history.historize(snippet);
            this.history.reset();
            this.set("");
        }
        return this.unlock();
    }

    unlock() {
        this.$container.removeClass("loading");
        this.code_mirror.setOption("readOnly", false);
        return this.focus();
    }

    get() {
        return this.code_mirror.getValue();
    }

    set(val: any) {
        return this.code_mirror.setValue(val);
    }

    leftpad(str: any, n: any, c?: any) {
        if (c == null) {
            c = " ";
        }
        const p = n - str.length;
        for (
            let i = 0, end = p, asc = 0 <= end;
            asc ? i <= end : i >= end;
            asc ? i++ : i--
        ) {
            str = c + str;
        }
        return str;
    }

    searchBack(back?: any) {
        if (back == null) {
            back = true;
        }
        this.$code_mirror.addClass("extra-dialog");
        const close = this.code_mirror.openDialog(
            `\
<span class="search-dialog-title">
  Search ${back ? "backward" : "forward"}:
</span>
<input type="text" style="width: 10em" class="CodeMirror-search-field"/>\
`,
            (val: any, e: any) => {
                return this.history.commitSearch();
            },
            {
                bottom: true,
                onInput: (e: any, val: any, close: any) => {
                    if (!val) {
                        return;
                    }
                    this.history.resetSearch();
                    return $(".CodeMirror-search-field").toggleClass(
                        "not-found",
                        val &&
                            !this.history[
                                close.back ? "searchNext" : "searchPrev"
                            ](val)
                    );
                },
                onKeyDown: (e: any, val: any, close: any) => {
                    if (
                        (e.keyCode === 82 && e.ctrlKey) ||
                        (e.keyCode === 83 && e.altKey)
                    ) {
                        close.back = true;
                        $(".search-dialog-title").text("Search backward:");
                        $(".CodeMirror-search-field").toggleClass(
                            "not-found",
                            val && !this.history.searchNext(val)
                        );
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (
                        (e.keyCode === 83 && e.ctrlKey) ||
                        (e.keyCode === 82 && e.altKey)
                    ) {
                        close.back = false;
                        $(".search-dialog-title").text("Search forward:");
                        $(".CodeMirror-search-field").toggleClass(
                            "not-found",
                            val && !this.history.searchPrev(val)
                        );
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (e.keyCode === 67 && e.ctrlKey) {
                        close();
                    }
                    return false;
                },

                onClose: (dialog: any) => {
                    this.history.rollbackSearch();
                    return this.$code_mirror.removeClass("extra-dialog");
                },
            }
        );
        return (close.back = back);
    }

    insert(str: any) {
        return this.code_mirror.replaceRange(str, this.code_mirror.getCursor());
    }

    changes() {
        return window.setTimeout(() => this.wdb.interpreter.scroll());
    }

    insertHistory(direction: string) {
        const h = this.history.getHistory(direction).reverse().join("\n");
        this.history.reset();
        return this.set(h);
    }
}

export { Prompt };
