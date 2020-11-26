# Stdlib:
import asyncio

# Aiohttp:
from aiohttp import web

# Thirdparty:
from aiomisc.service import TCPServer
from aiomisc.service.aiohttp import AIOHTTPService

# Firstparty:
from wdb_server.app import init_app
from wdb_server.utils.streams import handle_tcp_connection


# pylint: disable=too-few-public-methods
class WDBService(AIOHTTPService):
    """
    General WDB aiohttp service
    """

    __required__ = (
        "debug",
        "extra_search_path",
        "more",
        "detached_session",
        "show_filename",
    )

    # pylint: disable=missing-function-docstring
    async def create_application(self) -> web.Application:
        settings = {attr: getattr(self, attr) for attr in self.__required__}
        app = await init_app(settings=settings)
        return app


# pylint: disable=too-few-public-methods
class WDBTCPService(TCPServer):
    """
    General WDB tcp service
    """

    # pylint: disable=missing-function-docstring
    async def handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        await handle_tcp_connection(reader, writer)
