import { Log } from "./_base";
import { Prompt } from "./_prompt";
import { CodeMirror } from "./_codemirror";

class History extends Log {
    public prompt: Prompt;
    public index: number;
    public current: string;
    public currentPos: CodeMirror.Pos;
    public oldIndex: number;
    public originalIndex: number;
    public overlay: CodeMirror.Overlay;
    public history: string[];
    public sessionIndexStart: number;
    public lastResult: number;

    constructor(prompt: Prompt) {
        super();
        this.prompt = prompt;
        this.index = -1;
        this.current = "";
        this.currentPos = CodeMirror.Pos(0, 0);

        this.oldIndex = null;
        this.originalIndex = null;
        this.overlay = null;

        try {
            this.history = JSON.parse(localStorage["history"] || "[]");
        } catch (error) {
            const e = error;
            this.fail(e);
            this.history = [];
        }

        this.sessionIndexStart = this.history.filter(
            (e: string) => e.indexOf(".") !== 0
        ).length;
    }

    up(): number {
        if (this.index === -1) {
            this.saveCurrent();
        }

        this.index = Math.min(this.history.length - 1, this.index + 1);
        return this.sync();
    }

    down(): number {
        this.index = Math.max(this.index - 1, -1);
        return this.sync();
    }

    saveCurrent(): number {
        this.current = this.prompt.get();
        return (this.currentPos = this.prompt.code_mirror.getCursor());
    }

    sync(): number {
        if (this.index === -1) {
            this.prompt.set(this.current);
            return this.prompt.code_mirror.setCursor(this.currentPos);
        } else {
            this.prompt.set(this.history[this.index]);
            return this.prompt.code_mirror.setCursor(
                this.prompt.code_mirror.lineCount(),
                0
            );
        }
    }

    historize(snippet: string): string {
        let index;
        if (!snippet) {
            return;
        }
        while ((index = this.history.indexOf(snippet)) !== -1) {
            this.history.splice(index, 1);
        }
        this.history.unshift(snippet);
        return (
            localStorage &&
            (localStorage["history"] = JSON.stringify(this.history))
        );
    }

    reset(): number {
        this.index = -1;
        this.current = "";
        return (this.currentPos = CodeMirror.Pos(0, 0));
    }

    clear(): number {
        this.history = [];
        this.sessionIndexStart = 0;
        return this.reset();
    }

    getOverlay(re: RegExp): CodeMirror.Overlay {
        return {
            token(stream: CodeMirror.StringStream) {
                re.lastIndex = stream.pos;
                const match = re.exec(stream.string);
                if (match && match.index === stream.pos) {
                    stream.pos += match[0].length || 1;
                    return "searching";
                } else if (match) {
                    stream.pos = match.index;
                } else {
                    stream.skipToEnd();
                }
            },
        };
    }

    searchPrev(val: string): boolean {
        return this.searchNext(val, -1);
    }

    searchNext(val: string, step: number): boolean {
        if (step == null) {
            step = 1;
        }
        if (this.oldIndex == null) {
            this.oldIndex = this.index;
        }
        if (this.originalIndex == null) {
            this.originalIndex = this.index;
            if (this.index === -1) {
                this.saveCurrent();
            }
        }

        while (
            (step === 1 && this.index < this.history.length) ||
            (step === -1 && this.index > -1)
        ) {
            this.index += step;
            const re = new RegExp(
                `(${val.replace(
                    /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
                    "\\$&"
                )})`,
                "gi"
            );
            if (re.test(this.history[this.index])) {
                this.lastResult = this.index;
                this.sync();
                this.overlay != null &&
                    this.prompt.code_mirror.removeOverlay(this.overlay, true);
                this.overlay = this.getOverlay(re);
                this.prompt.code_mirror.addOverlay(this.overlay);
                return true;
            }
        }
        return false;
    }

    commitSearch(): number {
        this.oldIndex = null;
        this.originalIndex = null;
        this.index = this.lastResult;
        return this.sync();
    }

    rollbackSearch(): number {
        this.oldIndex = null;
        if (this.originalIndex != null) {
            this.index = this.originalIndex;
        }
        this.originalIndex = null;
        this.overlay != null &&
            this.prompt.code_mirror.removeOverlay(this.overlay, true);
        this.overlay = null;
        return this.sync();
    }

    resetSearch(): number {
        if (this.oldIndex != null) {
            this.index = this.oldIndex;
        }
        return (this.oldIndex = null);
    }

    getSessionHistory(): string[] {
        return this.history.slice(
            0,
            this.history.length - this.sessionIndexStart
        );
    }

    getHistory(direction: string) {
        let begin = 0;
        let end = this.history.length - this.sessionIndexStart;
        if (direction === "down") {
            end = this.index + 1;
        } else if (direction === "up") {
            begin = this.index;
        }
        return this.history.slice(begin, end);
    }
}

export { History };
