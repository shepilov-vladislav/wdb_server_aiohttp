import { Log } from "./_base";
import { Wdb } from "./wdb";
import "./scss/_traceback.scss";

class Traceback extends Log {
    public wdb: Wdb;
    public $traceback: JQuery;

    constructor(wdb: Wdb) {
        super();
        this.wdb = wdb;
        this.$traceback = $(".traceback");
        this.$traceback.on("click", ".trace-line", this.select.bind(this));
    }

    select(e: JQuery.ClickEvent) {
        const level = $(e.currentTarget).attr("data-level");
        this.wdb.select_trace(level);
        // Yeah...
        if ($(".mdl-layout__obfuscator").is(".is-visible")) {
            // @ts-ignore
            $(".mdl-layout").get(0).MaterialLayout.toggleDrawer();
        }
        return false;
    }

    make_trace(trace: any) {
        this.clear();
        this.show();
        return (() => {
            const result = [];
            for (let frame of Array.from(trace) as any) {
                var $tracebody;
                const $traceline = $("<a>", {
                    class:
                        `trace-line ellipsis \
mdl-list__item mdl-list__item--three-line trace-` + frame.level,
                })
                    .attr("data-level", frame.level)
                    .attr(
                        "title",
                        `File \"${frame.file}\", line ${frame.lno}, in ${frame.function}\n` +
                            `    ${frame.code}`
                    );

                for (let brk of Array.from(
                    this.wdb.source.breakpoints[frame.file] || []
                ) as any) {
                    if (!brk.cond && !brk.fun && !brk.lno) {
                        $traceline.addClass("breakpoint");
                        break;
                    }
                }

                if (frame.current) {
                    $traceline.addClass("real-selected");
                }

                const $primary = $("<div>", {
                    class: "mdl-list__item-primary-content",
                });
                $primary.append(
                    $("<div>", { class: "ellipsis" }).text(frame.function)
                );

                $primary.append(
                    $("<div>", { class: "mdl-list__item-text-body" })
                        .append(
                            ($tracebody = $("<div>", { class: "ellipsis" }))
                        )
                        .append(
                            $("<div>", { class: "ellipsis" })
                                .text(
                                    frame.file.split("/").slice(-1)[0] +
                                        ":" +
                                        frame.lno
                                )
                                .prepend(
                                    $("<i>", { class: "material-icons" }).text(
                                        this.get_fn_icon(frame.file)
                                    )
                                )
                        )
                );

                this.wdb.code($tracebody, frame.code, ["ellipsis"]);

                $traceline.append($primary);
                result.push(this.$traceback.prepend($traceline));
            }
            return result;
        })();
    }

    hide() {
        return this.$traceback.addClass("hidden");
    }

    show() {
        return this.$traceback.removeClass("hidden");
    }

    clear() {
        return this.$traceback.empty();
    }

    get_fn_icon(fn: string) {
        // TODO: other platforms
        if (!!~fn.indexOf("site-packages")) {
            return "library_books";
        } else if (fn.startsWith(this.wdb.cwd) || fn[0] !== "/") {
            return "star";
        } else if (fn.startsWith("/home/")) {
            return "home";
        } else if (fn.startsWith("/usr/lib") && !!~fn.indexOf("/python")) {
            return "lock";
        } else {
            return "cloud";
        }
    }
}

export { Traceback };
