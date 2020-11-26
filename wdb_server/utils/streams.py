# Stdlib:
import asyncio
import json
import logging
from asyncio.exceptions import IncompleteReadError
from struct import unpack

# Firstparty:
from wdb_server.constants import UNKNOWN_UUID
from wdb_server.utils.state import breakpoints, sockets, websockets

log = logging.getLogger("wdb_server")


class IOStream:
    """
    Base class for interacting with reader/writer
    """

    __slots__ = ["_reader", "_writer", "_uuid"]

    def __init__(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        self._reader: asyncio.StreamReader = reader
        self._writer: asyncio.StreamWriter = writer
        self._uuid: str = UNKNOWN_UUID

    @property
    def uuid(self) -> str:
        """The uuid property."""
        return self._uuid

    @uuid.setter
    def uuid(self, uuid: str) -> None:
        self._uuid = uuid

    async def readexactly(self, num_bytes: int) -> bytes:
        """
        Alias to asyncio.StreamReader.readexactly
        """
        return await self._reader.readexactly(num_bytes)

    async def write(self, data: bytes) -> None:
        """
        Alias to asyncio.StreamWriter.write with drain after
        """
        self._writer.write(data)
        await self._writer.drain()

    async def close(self) -> None:
        """
        Close active socket
        """
        self._writer.close()
        try:
            await self._writer.wait_closed()
        except BrokenPipeError:
            pass
        finally:
            await self.on_close()

    async def on_close(self) -> None:
        """
        Clean store and broadcast messages
        """
        # None if the user closed the window
        log.info("uuid %s closed", self.uuid)
        if websockets.get(self.uuid):
            try:
                await websockets.send(self.uuid, "Die")
            except ConnectionResetError:
                log.warning("Closed stream for %s", self.uuid)
            await websockets.close(self.uuid)
            await websockets.remove(self.uuid)
        await sockets.remove(self.uuid)


async def read_frame(stream: IOStream, uuid: str, frame: bytes) -> None:
    """
    Decode frame and process.
    """
    decoded_frame = frame.decode("utf-8")
    if decoded_frame == "ServerBreaks":
        await sockets.send(uuid, json.dumps(breakpoints.get()))
    elif decoded_frame == "PING":
        log.info("%s PONG", uuid)
    elif decoded_frame.startswith("UPDATE_FILENAME"):
        filename = decoded_frame.split("|", 1)[1]
        await sockets.set_filename(uuid, filename)
    else:
        await websockets.send(uuid, frame.decode("utf-8"))
    try:
        await read_header(stream, uuid, await stream.readexactly(4))
    except IncompleteReadError:
        log.warning("Closed stream for %s", uuid)


async def read_header(stream: IOStream, uuid: str, _length: bytes) -> None:
    """
    Read header data and process frame.
    """
    (length,) = unpack("!i", _length)
    try:
        await read_frame(stream, uuid, await stream.readexactly(length))
    except IncompleteReadError:
        log.warning("Closed stream for %s", uuid)


async def assign_stream(stream: IOStream, _uuid: bytes) -> None:
    """
    Assign IOStream and socket.
    """
    uuid = _uuid.decode("utf-8")
    log.debug("Assigning stream to %s", uuid)
    await sockets.add(uuid, stream)
    stream.uuid = uuid
    try:
        await read_header(stream, uuid, await stream.readexactly(4))
    except IncompleteReadError:
        log.warning("Closed stream for %s", uuid)


async def read_uuid_size(stream: IOStream, _length: bytes) -> None:
    """
    Read UUID and go ahead.
    """
    (length,) = unpack("!i", _length)
    assert length == 36, "Wrong uuid"
    try:
        await assign_stream(stream, await stream.readexactly(length))
    except IncompleteReadError:
        log.warning("Closed stream for getting uuid")


async def handle_tcp_connection(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter
) -> None:
    """
    General handler function to handle input TCP connections.
    """
    address = writer.get_extra_info("peername")[0]
    log.info("Connection received from %s", str(address))
    stream = IOStream(reader, writer)
    try:
        await read_uuid_size(stream, await stream.readexactly(4))
    except IncompleteReadError:
        log.warning("Closed stream for getting uuid length")
    finally:
        await stream.close()
        del stream
