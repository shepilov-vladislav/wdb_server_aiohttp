# pylint: disable=missing-class-docstring, missing-function-docstring
# pylint: disable=c-extension-no-member
# Stdlib:
import asyncio
import json
import logging
import os
from typing import Dict
from uuid import uuid4

# Aiohttp:
import aiohttp
from aiohttp import web

# Thirdparty:
import aiohttp_jinja2
from aiomultiprocess import Process

# Firstparty:
from wdb_server.constants import UNKNOWN_UUID, WDB_TYPES
from wdb_server.utils.state import (
    breakpoints,
    sockets,
    syncwebsockets,
    websockets,
)
from wdb_server.utils.technical import LibPythonWatcher, refresh_process

log = logging.getLogger("wdb_server")


async def self_shell() -> None:  # pragma: no cover
    """
    Function for run self shell(debug)
    """
    # pylint: disable=import-outside-toplevel
    import wdb  # isort:skip

    wdb.set_trace()  # pylint: disable=no-member


async def run_shell() -> None:  # pragma: no cover
    """
    Function for run shell(debug)
    """
    # pylint: disable=import-outside-toplevel
    from wdb import Wdb  # isort:skip

    Wdb.get().shell()


async def run_file(file_name: str) -> None:  # pragma: no cover
    """
    Function for run file debug
    """
    # pylint: disable=import-outside-toplevel
    from wdb import Wdb  # isort:skip

    Wdb.get().run_file(file_name)


class HomeHandler(web.View):
    @aiohttp_jinja2.template("home.html")
    async def get(self) -> Dict[str, str]:
        return {}

    async def post(self) -> None:
        data = await self.request.post()
        updates = {
            type_: data[f"theme_{type_}"]
            for type_ in WDB_TYPES
            if f"theme_{type_}" in data
        }
        self.request.app["theme"] = self.request.app["theme"] | updates
        raise web.HTTPFound(location="/")


# pylint: disable=too-few-public-methods
class MainHandler(web.View):
    @aiohttp_jinja2.template("wdb.html")
    async def get(self) -> Dict[str, str]:
        type_ = self.request.match_info["type_"]
        if type_ not in WDB_TYPES:
            raise web.HTTPNotFound(reason=f"type_ {type_} Not Found")
        uuid = self.request.match_info["uuid"]
        return {
            "uuid": uuid,
            "new_version": self.request.app["new_version"],
            "type_": type_,
        }


class DebugHandler(web.View):
    def _debug(self, fnc: str) -> None:  # pylint: disable=no-self-use
        Process(target=run_file, args=(fnc,)).start()
        raise web.HTTPFound(location="/")

    async def get(self) -> None:
        fnc = self.request.match_info["fn"]
        self._debug(fnc)

    async def post(self) -> None:
        data = await self.request.post()
        if "debug_file" in data:
            self._debug(data["debug_file"])


class BaseWebSocketHandler(web.View):
    uuid: str = UNKNOWN_UUID

    async def write(self, message: str) -> None:
        raise NotImplementedError

    async def write_message(self, message: str) -> None:
        await self.ws.send_str(message)

    async def open(self) -> None:
        await self.on_open()

    async def on_open(self) -> None:
        raise NotImplementedError

    async def on_message(self, message: str) -> None:
        raise NotImplementedError

    async def close(self) -> None:
        await self.on_close()

    async def on_close(self) -> None:
        raise NotImplementedError

    async def get(self) -> None:
        # pylint: disable=invalid-name, attribute-defined-outside-init
        self.ws = web.WebSocketResponse()
        await self.ws.prepare(self.request)

        await self.open()

        async for msg in self.ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await self.on_message(msg.data)
            if msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                break

        await self.close()


class SyncWebSocketHandler(BaseWebSocketHandler):
    async def write(self, message: str) -> None:
        log.debug("server -> syncsocket: %s", message)
        await self.write_message(message)

    async def on_open(self) -> None:
        self.uuid = str(uuid4())
        await syncwebsockets.add(self.uuid, self)
        if not LibPythonWatcher:
            await syncwebsockets.send(self.uuid, "StartLoop")

    # pylint: disable=too-many-branches
    async def on_message(self, message: str) -> None:
        if "|" in message:
            cmd, data = message.split("|", 1)
        else:
            cmd, data = message, ""

        if cmd == "ListSockets":
            for uuid in sockets.uuids:
                await syncwebsockets.send(
                    self.uuid,
                    "AddSocket",
                    {
                        "uuid": uuid,
                        "filename": sockets.get_filename(uuid)
                        if self.request.app["settings"].show_filename
                        else "",
                    },
                )
        elif cmd == "ListWebsockets":
            for uuid in websockets.uuids:
                await syncwebsockets.send(self.uuid, "AddWebSocket", uuid)
        elif cmd == "ListBreaks":
            for brk in breakpoints.get():
                await syncwebsockets.send(self.uuid, "AddBreak", brk)
        elif cmd == "RemoveBreak":
            brk = json.loads(data)
            await breakpoints.remove(brk)
            # If it was here, it wasn't temporary
            brk["temporary"] = False
            await sockets.broadcast("Unbreak", brk)
        elif cmd == "RemoveUUID":
            await sockets.close(data)
            await sockets.remove(data)
            await websockets.close(data)
            await websockets.remove(data)
        elif cmd == "ListProcesses":
            await refresh_process(self.uuid)
        elif cmd == "Pause":
            if int(data) == os.getpid():
                log.debug("Pausing self")
                Process(target=self_shell).start()

            else:
                log.debug("Pausing %s", data)
                command = ["gdb", "-p", data, "-batch"] + [
                    f"-eval-command=call {hook}"
                    for hook in [
                        "PyGILState_Ensure()",
                        "PyRun_SimpleString("
                        '"import wdb; wdb.set_trace(skip=1)"'
                        ")",
                        "PyGILState_Release($1)",
                    ]
                ]
                await asyncio.create_subprocess_exec(
                    *command,
                    stdin=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
        elif cmd == "RunFile":
            Process(target=run_file, args=(data,)).start()
        elif cmd == "RunShell":
            Process(target=run_shell).start()

    async def on_close(self) -> None:
        if hasattr(self, "uuid"):
            await syncwebsockets.remove(self.uuid)


class WebSocketHandler(BaseWebSocketHandler):
    async def write(self, message: str) -> None:
        log.debug("socket -> websocket: %s", message)
        if message.startswith("BreakSet|") or message.startswith(
            "BreakUnset|"
        ):
            log.debug("Intercepted break")
            cmd, _brk = message.split("|", 1)
            brk = json.loads(_brk)
            if not brk["temporary"]:
                del brk["temporary"]
                if cmd == "BreakSet":
                    await breakpoints.add(brk)
                elif cmd == "BreakUnset":
                    await breakpoints.remove(brk)

        await self.write_message(message)

    async def on_open(self) -> None:
        if self.uuid in websockets.uuids:
            log.warning(
                "Websocket already opened for %s. Closing previous one",
                self.uuid,
            )
            await websockets.send(self.uuid, "Die")
            await websockets.close(self.uuid)

        if self.uuid not in sockets.uuids:
            log.warning(
                "Websocket opened for %s with no correponding socket",
                self.uuid,
            )
            await sockets.send(self.uuid, "Die")
            await self.close()
            return

        log.info("Websocket opened for %s", self.uuid)
        await websockets.add(self.uuid, self)

    async def on_message(self, message: str) -> None:
        log.debug("websocket -> socket: %s", message)
        if message.startswith("Broadcast|"):
            message = message.split("|", 1)[1]
            await sockets.broadcast(message)
        else:
            await sockets.send(self.uuid, message)

    async def on_close(self) -> None:
        if hasattr(self, "uuid"):
            log.info("Websocket closed for %s", self.uuid)
            if not self.request.app["settings"].detached_session:
                await sockets.send(self.uuid, "Close")
                await sockets.close(self.uuid)

    async def get(self) -> None:
        self.uuid = self.request.match_info["uuid"]
        await super().get()
