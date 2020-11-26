import { Log } from "./_base";
import { Wdb } from "./wdb";
import "./scss/_switch.scss";

class Switch extends Log {
    public wdb: Wdb;
    public $trace: JQuery;
    public $switches: JQuery;
    public $command: JQuery;
    public $source: JQuery;
    public $interpreter: JQuery;

    constructor(wdb: Wdb) {
        super();
        this.wdb = wdb;
        this.$trace = $(".trace");
        this.$switches = $(".switch").click((e) =>
            this.switch($(e.currentTarget))
        );
        this.$command = $(".command").click((e) =>
            this.command($(e.currentTarget))
        );
        this.$source = $(".source");
        this.$interpreter = $(".interpreter");
    }

    switch($switch: JQuery) {
        if ($switch.is(".power")) {
            if ($switch.is(".off")) {
                return this.wdb.disable();
            } else if ($switch.is(".on")) {
                return parent.postMessage("activate", "*");
            }
        } else if ($switch.is(".code")) {
            if ($switch.is(".off")) {
                return this.open_code();
            } else if ($switch.is(".on")) {
                return this.close_code();
            }
        } else if ($switch.is(".term")) {
            if ($switch.is(".off")) {
                return this.open_term();
            } else if ($switch.is(".on")) {
                return this.close_term();
            }
        }
    }

    open_trace() {
        return this.$trace.addClass("mdl-layout--fixed-drawer");
    }

    close_trace() {
        return this.$trace.removeClass("mdl-layout--fixed-drawer");
    }

    open_code() {
        this.$switches
            .filter(".code")
            .removeClass("off")
            .addClass("on")
            .removeClass("mdl-button--accent");
        this.$source.removeClass("hidden");
        return this.wdb.source.size();
    }

    close_code() {
        this.$switches
            .filter(".code")
            .removeClass("on")
            .addClass("off")
            .addClass("mdl-button--accent");
        this.$source.addClass("hidden");
        return this.wdb.source.size();
    }

    open_term() {
        this.$switches
            .filter(".term")
            .removeClass("off")
            .addClass("on")
            .removeClass("mdl-button--accent");
        this.$interpreter.removeClass("hidden");
        return this.wdb.source.size();
    }

    close_term() {
        this.$switches
            .filter(".term")
            .removeClass("on")
            .addClass("off")
            .addClass("mdl-button--accent");
        this.$interpreter.addClass("hidden");
        return this.wdb.source.size();
    }

    command($command: JQuery) {
        return this.wdb.execute("." + $command.attr("data-command"));
    }
}

export { Switch };
