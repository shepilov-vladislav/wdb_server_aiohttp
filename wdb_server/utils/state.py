# Stdlib:
import json
import logging
from struct import pack
from typing import Any, Dict, List, Optional, Set, Union

log = logging.getLogger("wdb_server")


class BaseSockets:
    """
    Base class for implement protocol for TCP/Web Socket.
    """

    __slots__ = ["_sockets"]

    def __init__(self) -> None:
        self._sockets: Dict[str, Any] = {}

    async def send(
        self,
        uuid: str,
        data: str,
        message: Optional[Union[Dict[str, Any], List[int], str]] = None,
    ) -> None:
        """
        Send messsage to TCP/Web Socket by uuid.
        """
        if message:
            data = data + "|" + json.dumps(message)
        sck = self.get(uuid)
        if sck is not None:
            await self._send(sck, data)
        else:
            log.warning("No socket found for %s", uuid)

    async def _send(self, sck: Any, data: str) -> None:
        raise NotImplementedError

    def get(self, uuid: str) -> Any:
        """
        Simple getter for retrieve TCP/Web Socket by uuid.
        """
        return self._sockets.get(uuid)

    async def broadcast(
        self,
        cmd: str,
        message: Optional[Union[Dict[str, Any], List[int], str]] = None,
    ) -> None:
        """
        Broadcast message to TCP/Web Socket.
        """
        for uuid in list(self._sockets.keys()):
            try:
                log.debug("Broadcast to socket %s", uuid)
                await self.send(uuid, cmd, message)
            except Exception:  # pylint: disable=broad-except
                log.warning("Failed broadcast to socket %s", uuid)
                await self.close(uuid)
                await self.remove(uuid)

    async def add(self, uuid: str, sck: Any) -> None:
        """
        Function which add/re-add TCP/Web Socket to store.
        """
        if uuid in self._sockets:
            await self.remove(uuid)
            await self.close(uuid)

        self._sockets[uuid] = sck

    async def remove(self, uuid: str) -> None:
        """
        Function which remove TCP/Web Socket from store.
        """
        sck = self._sockets.pop(uuid, None)
        if sck:
            await syncwebsockets.broadcast(
                "Remove" + self.__class__.__name__.rstrip("s"), uuid
            )

    async def close(self, uuid: str) -> None:
        """
        Function which close TCP/Web Socket.
        """
        sck = self.get(uuid)
        if sck is not None:
            try:
                await sck.close()
            except Exception:  # pylint: disable=broad-except
                log.warning("Failed close to socket %s", uuid)

    @property
    def uuids(self) -> Set[str]:
        """
        Simple property to return all UUID's.
        """
        return set(self._sockets.keys())


class Sockets(BaseSockets):
    """
    General store for active TCP Sockets.
    """

    __slots__ = ["_sockets", "_filenames"]

    def __init__(self) -> None:
        super().__init__()
        self._filenames: Dict[str, Any] = {}

    async def add(self, uuid: str, sck: Any) -> None:
        await super().add(uuid, sck)
        await syncwebsockets.broadcast("AddSocket", {"uuid": uuid})

    async def remove(self, uuid: str) -> None:
        await super().remove(uuid)
        self._filenames.pop(uuid, None)

    def get_filename(self, uuid: str) -> str:
        """
        Simple getter for retrieve filename by uuid.
        """
        return self._filenames.get(uuid, "")

    async def set_filename(self, uuid: str, filename: str) -> None:
        """
        Simple setter for set filename for uuid.
        """
        self._filenames[uuid] = filename
        await syncwebsockets.broadcast(
            "AddSocket",
            {
                "uuid": uuid,
                "filename": filename if settings.show_filename else "",
            },
        )

    async def _send(self, sck: Any, data: str) -> None:
        await sck.write(pack("!i", len(data)))
        await sck.write(data.encode("utf-8"))


class BaseWebSockets(BaseSockets):
    """
    Base class for implement WebSockets/SyncWebSockets
    """

    __slots__ = ["_sockets"]

    async def _send(self, sck: Any, data: str) -> None:
        if hasattr(sck, "ws"):
            await sck.write_message(data)
        else:
            log.warning("Websocket is closed")


class WebSockets(BaseWebSockets):
    """
    General store for active WebSockets.
    """

    __slots__ = ["_sockets"]

    async def add(self, uuid: str, sck: Any) -> None:
        await super().add(uuid, sck)
        await syncwebsockets.broadcast("AddWebSocket", uuid)


class SyncWebSockets(BaseWebSockets):
    """
    General store for active synchronization WebSockets.
    """

    __slots__ = ["_sockets"]


class Breakpoints:
    """
    General store for active breakpoints.
    """

    __slots__ = ["_breakpoints"]

    def __init__(self) -> None:
        self._breakpoints: List[Any] = []

    async def add(self, brk: Any) -> None:
        """
        Add breakpoint to store and broadcast messaage about it.
        """
        if brk not in self._breakpoints:
            self._breakpoints.append(brk)
            await syncwebsockets.broadcast("AddBreak|" + json.dumps(brk))

    async def remove(self, brk: Any) -> None:
        """
        Remove breakpoint from store and broadcast messaage about it.
        """
        if brk in self._breakpoints:
            self._breakpoints.remove(brk)
            await syncwebsockets.broadcast("RemoveBreak|" + json.dumps(brk))

    def get(self) -> List[Any]:
        """
        Simple getter for access to breakpoints store.
        """
        return self._breakpoints


# pylint: disable=too-few-public-methods
class Settings:
    """
    Simple class for store application settings
    """

    __slots__ = [
        "debug",
        "extra_search_path",
        "more",
        "detached_session",
        "show_filename",
    ]

    def __init__(self, **kwargs: Any) -> None:
        self.debug: bool = False
        self.extra_search_path: bool = False
        self.more: bool = False
        self.detached_session: bool = False
        self.show_filename: bool = False
        self._set_params(**kwargs)

    def update(self, **kwargs: Any) -> None:
        """
        Update attributes afteer init
        """
        self._set_params(**kwargs)

    def _set_params(self, **kwargs: Any) -> None:
        for name, value in kwargs.items():
            setattr(self, name, value)


sockets = Sockets()
websockets = WebSockets()
syncwebsockets = SyncWebSockets()
breakpoints = Breakpoints()
settings = Settings()
