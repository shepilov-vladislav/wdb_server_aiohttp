import "material-design-lite/material";
import "typeface-roboto/index.css";
import "typeface-roboto-mono/index.css";
import "./scss/home.scss";

let ws: WebSocket = null;
let wait: any = 25;

const make_uuid_line = function (uuid: string, socket: any, filename?: string) {
    let $line;
    filename = filename || "";
    if (!($line = $(`.sessions tr[data-uuid=${uuid}]`)).length) {
        $line = $(`<tr data-uuid=\"${uuid}\"> \
<td class=\"uuid mdl-data-table__cell--non-numeric\"> \
<a href=\"/debug/session/${uuid}\">${uuid}</a> \
</td> \
<td class=\"socket mdl-data-table__cell--non-numeric\">No</td> \
<td class=\"websocket mdl-data-table__cell--non-numeric\">No</td> \
<td class=\"action\"> \
<button class=\"mdl-button mdl-js-button mdl-button--icon close \
mdl-button--colored\" title=\"Force close\"> \
<i class=\"material-icons\">close</i> \
</button> \
</td>\
`);
        if ($(".sessions .filename-head").length) {
            $line.prepend(`\
<td class=\"filename mdl-data-table__cell--non-numeric\"> \
<span>${filename}</span> \
</td>\
`);
        }
        $(".sessions tbody").append($line);
    }
    $line.find(`.${socket}`).text("Yes");
    if (filename) {
        return $line.find(".filename span").text(filename);
    }
};

const rm_uuid_line = function (uuid: any, socket: any) {
    let $line;
    if (!($line = $(`.sessions tr[data-uuid=${uuid}]`)).length) {
        return;
    }
    if (
        (socket === "socket" && $line.find(".websocket").text() === "No") ||
        (socket === "websocket" && $line.find(".socket").text() === "No")
    ) {
        return $line.remove();
    } else {
        return $line.find(`.${socket}`).text("No");
    }
};

const make_brk_line = function (brk: any) {
    let line = "<tr>";
    for (let elt of ["fn", "lno", "cond", "fun"]) {
        line += `<td class=\"${elt}\">${brk[elt] || "∅"}</td>`;
    }
    line += `<td class=\"action\"> \
<button class=\"mdl-button mdl-js-button mdl-button--icon open \
mdl-button--colored\" title=\"Open\"> \
<i class=\"material-icons\">open_in_new</i> \
</button> \
<button class=\"mdl-button mdl-js-button mdl-button--icon delete \
mdl-button--colored\" title=\"Remove\"> \
<i class=\"material-icons\">delete</i> \
</button> \
</td>`;

    line += "</tr>";
    return $(".breakpoints tbody").append($(line));
};

const rm_brk_line = (brk: any) =>
    (() => {
        const result = [];
        for (let tr of Array.from($(".breakpoints tr"))) {
            const $tr = $(tr);
            let same = true;
            for (let elt of ["fn", "lno", "cond", "fun"]) {
                same =
                    same &&
                    $tr.find(`.${elt}`).text() === "" + (brk[elt] || "∅");
            }
            if (same) {
                result.push($tr.remove());
            } else {
                result.push(undefined);
            }
        }
        return result;
    })();

const get_proc_thread_val = function (obj: any, elt: any) {
    let val = obj[elt];
    if (val == null) {
        return "∅";
    }
    if (elt === "time") {
        const timeSince = function (date: any) {
            const seconds = Math.floor((new Date().getTime() - date) / 1000);
            let interval = Math.floor(seconds / 31536000);
            if (interval > 1) {
                return interval + "y";
            }
            interval = Math.floor(seconds / 2592000);
            if (interval > 1) {
                return interval + "mo";
            }
            interval = Math.floor(seconds / 86400);
            if (interval > 1) {
                return interval + "d";
            }
            interval = Math.floor(seconds / 3600);
            if (interval > 1) {
                return interval + "h";
            }
            interval = Math.floor(seconds / 60);
            if (interval > 1) {
                return interval + "m";
            }
            return Math.floor(seconds) + "s";
        };

        val = timeSince(1000 * val);
    } else if (["mem", "cpu"].includes(elt)) {
        val = val.toFixed(2) + "%";
    } else if (elt === "cmd") {
        const parts = [];
        for (let part of Array.from(val.split(" ")) as any) {
            if (part.indexOf("/") === 0) {
                parts.push(
                    `<abbr title=\"${part}\">${part
                        .split("/")
                        .slice(-1)}</abbr>`
                );
            } else if (part.indexOf(":") === 1 && part.indexOf("\\") === 2) {
                parts.push(`<abbr title=\"${part}\"> \
${part.slice(3).split("\\").slice(-1)}</abbr>`);
            } else {
                parts.push(part);
            }
        }
        val = parts.join(" ");
    }
    return val;
};

const make_process_line = function (proc: any) {
    let $tr;
    if (($tr = $(`.processes tbody tr[data-pid=${proc.pid}]`)).length) {
        return (() => {
            const result = [];
            for (let elt of ["pid", "user", "cmd", "time", "mem", "cpu"]) {
                result.push(
                    $tr.find(`.${elt}`).html(get_proc_thread_val(proc, elt))
                );
            }
            return result;
        })();
    } else {
        let line = `<tr data-pid=\"${proc.pid}\" \
${proc.threadof ? 'data-threadof="' + proc.threadof + '"' : ""}>`;
        for (let elt of ["pid", "user", "cmd", "time", "mem", "cpu"]) {
            line += `<td class=\"rowspan ${elt}\"> \
${get_proc_thread_val(proc, elt)}</td>`;
        }
        line += `\
  <td class=\"action\">
    <button class=\"mdl-button mdl-js-button mdl-button--icon plus \
mdl-button--colored\" title=\"Toggle threads\">
      <i class=\"material-icons\">add</i>
    </button>
  </td>
  <td class=\"action\">
    <button class=\"mdl-button mdl-js-button mdl-button--icon pause \
mdl-button--colored\" title=\"Pause\">
      <i class=\"material-icons\">pause</i>
    </button>
  </td>
</tr>\
`;
        return $(".processes tbody").append($(line));
    }
};

const make_thread_line = function (thread: any) {
    let $tr: any;
    const $proc = $(`.processes tbody tr[data-pid=${thread.of}]`);
    if (!$proc.length) {
        return;
    }

    if (($tr = $(`.processes tbody tr[data-tid=${thread.id}]`)).length) {
        return ["id", "of"].map((elt) =>
            $tr.find(`.${elt}`).text(get_proc_thread_val(thread, elt))
        );
    } else {
        const line = `\
<tr data-tid=\"${thread.id}\" data-of=\"${thread.of}\"
  style="display: none">
  <td class=\"id\">${get_proc_thread_val(thread, "id")}</td>
  <td class=\"action\">
    <button class=\"mdl-button mdl-js-button mdl-button--icon pause \
mdl-button--colored\" title=\"Pause\">
      <i class=\"material-icons\">pause</i>
    </button>
  </td>
</tr>\
`;
        const $next = $proc.nextAll("[data-pid]");
        if ($next.length) {
            return $next.before(line);
        } else {
            return $(".processes tbody").append(line);
        }
    }
};
// $proc.find('.rowspan').attr('rowspan',
//   (+$proc.find('.rowspan').attr('rowspan') or 1) + 1)

const ws_message = function (event: any) {
    let cmd, data;
    wait = 25;
    const message = event.data;
    const pipe = message.indexOf("|");
    if (pipe > -1) {
        cmd = message.substr(0, pipe);
        data = JSON.parse(message.substr(pipe + 1));
    } else {
        cmd = message;
        data = "";
    }

    switch (cmd) {
        case "AddWebSocket":
            return make_uuid_line(data, "websocket");
        case "AddSocket":
            return make_uuid_line(data.uuid, "socket", data.filename);
        case "RemoveWebSocket":
            return rm_uuid_line(data, "websocket");
        case "RemoveSocket":
            return rm_uuid_line(data, "socket");
        case "AddBreak":
            return make_brk_line(data);
        case "RemoveBreak":
            return rm_brk_line(data);
        case "AddProcess":
            return make_process_line(data);
        case "AddThread":
            return make_thread_line(data);
        case "KeepProcess":
            return (() => {
                const result = [];
                for (let tr of Array.from($(".processes tbody tr[data-pid]"))) {
                    var needle;
                    const $tr = $(tr);
                    if (
                        ((needle = parseInt($tr.attr("data-pid"))),
                        !Array.from(data).includes(needle))
                    ) {
                        $(
                            `.processes [data-of=${$tr.attr("data-pid")}]`
                        ).remove();
                        result.push($tr.remove());
                    } else {
                        result.push(undefined);
                    }
                }
                return result;
            })();

        case "KeepProcess":
            return (() => {
                const result1 = [];
                for (let tr of Array.from($(".processes tbody tr[data-tid]"))) {
                    var needle1;
                    const $tr = $(tr);
                    if (
                        ((needle1 = parseInt($tr.attr("data-tid"))),
                        !Array.from(data).includes(needle1))
                    ) {
                        $tr.remove();
                        const $proc = $(
                            `.processes [data-pid=${$tr.attr("data-of")}]`
                        );
                        result1.push(
                            $proc.attr("rowspan", +$proc.attr("rowspan") - 1)
                        );
                    } else {
                        result1.push(undefined);
                    }
                }
                return result1;
            })();

        case "StartLoop":
            // In case inotify is not available
            return setInterval(() => ws.send("ListProcesses"), 2000);
    }
};

var create_socket = function () {
    const proto = document.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/status`);
    ws.onopen = function () {
        $("tbody tr").remove();
        ws.send("ListSockets");
        ws.send("ListWebSockets");
        ws.send("ListBreaks");
        return ws.send("ListProcesses");
    };

    ws.onerror = function () {};

    ws.onmessage = ws_message;
    return (ws.onclose = function () {
        wait *= 2;
        return setTimeout(create_socket, wait);
    });
};

const null_if_void = function (s: any) {
    if (s === "∅") {
        return null;
    } else {
        return s;
    }
};

$(function () {
    create_socket();
    $(".sessions tbody").on("click", ".close", function (e) {
        ws.send("RemoveUUID|" + $(this).closest("tr").attr("data-uuid"));
        return false;
    });

    $(".breakpoints tbody").on("click", ".open", function (e) {
        const $tr = $(this).closest("tr");
        ws.send("RunFile|" + $tr.find(".fn").text());
        return false;
    });

    $(".breakpoints tbody").on("click", ".delete", function (e) {
        const $tr = $(this).closest("tr");
        const brk = {
            fn: $tr.find(".fn").text(),
            lno: parseInt($tr.find(".lno").text()),
            cond: null_if_void($tr.find(".cond").text()),
            fun: null_if_void($tr.find(".fun").text()),
        };

        ws.send("RemoveBreak|" + JSON.stringify(brk));
        return false;
    });

    $(".processes tbody")
        .on("click", ".pause", function (e) {
            const $tr = $(this).closest("tr");
            ws.send("Pause|" + ($tr.attr("data-pid") || $tr.attr("data-tid")));
            return false;
        })
        .on("click", ".minus", function (e) {
            const $button = $(this);
            const $tr = $button.closest("tr");
            $(`[data-of=${$tr.attr("data-pid")}]`).hide();
            $tr.find(".rowspan").attr("rowspan", 1);
            $button.removeClass("minus").addClass("plus").find("i").text("add");
            return false;
        })
        .on("click", ".plus", function (e) {
            const $button = $(this);
            const $tr = $button.closest("tr");
            const rowspan = $(`[data-of=${$tr.attr("data-pid")}]`).show()
                .length;
            $tr.find(".rowspan").attr("rowspan", rowspan + 1);
            $button
                .removeClass("plus")
                .addClass("minus")
                .find("i")
                .text("remove");
            return false;
        });

    $(".runfile").on("submit", function () {
        ws.send("RunFile|" + $(this).find("[type=text]").val());
        return false;
    });

    return $(".open-shell button").on("click", (e) => ws.send("RunShell"));
});
