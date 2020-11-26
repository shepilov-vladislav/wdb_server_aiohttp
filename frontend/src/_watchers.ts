import { Log } from "./_base";
import { Wdb } from "./wdb";
import "./scss/_watchers.scss";

class Watchers extends Log {
    public wdb: Wdb;
    public $watchers: JQuery;

    constructor(wdb: Wdb) {
        super();
        this.wdb = wdb;
        this.$watchers = $(".watchers").on(
            "click",
            ".watching .name",
            this.unwatch.bind(this)
        );
    }

    unwatch(e: JQuery.ClickEvent) {
        const expr = $(e.currentTarget).closest(".watching").attr("data-expr");
        return this.wdb.unwatch(expr);
    }

    updateAll(watchers: any) {
        for (let watcher of Object.keys(watchers || {})) {
            const value = watchers[watcher];
            this.update(watcher, value);
        }
        this.$watchers.find(".watching:not(.updated)").remove();
        return this.$watchers.find(".watching").removeClass("updated");
    }

    update(watcher: any, value: any) {
        let $watcher = this.$watchers
            .find(".watching")
            .filter((e: any) => $(e).attr("data-expr") === watcher);
        if (!$watcher.length) {
            const $name = $("<code>", { class: "name" });
            const $value = $("<div>", { class: "value" });
            this.$watchers.append(
                ($watcher = $("<div>", { class: "watching" })
                    .attr("data-expr", watcher)
                    .append(
                        $name.text(watcher),
                        $("<code>").text(": "),
                        $value
                    ))
            );
            this.wdb.code($value, value.toString(), [], true);
        } else {
            $watcher.find(".value code").remove();
            this.wdb.code($watcher.find(".value"), value.toString(), [], true);
        }
        return $watcher.addClass("updated");
    }
}

export { Watchers };
