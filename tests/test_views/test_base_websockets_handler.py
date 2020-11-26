# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name

# Aiohttp:
from aiohttp import web

# Thirdparty:
import pytest

# Firstparty:
from wdb_server.views import BaseWebSocketHandler


@pytest.fixture
async def client_ws(aiohttp_client):
    app = web.Application()
    app.router.add_route("*", "/base_ws", BaseWebSocketHandler)
    return await aiohttp_client(app)


async def test_open_close(mocker, client_ws):
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_open")
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_message")
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_close")
    data = "data"
    async with client_ws.ws_connect("/base_ws") as ws:
        assert BaseWebSocketHandler.on_open.call_count == 1
        BaseWebSocketHandler.on_message.assert_not_called()
        await ws.send_str(data)
        BaseWebSocketHandler.on_close.assert_not_called()
    BaseWebSocketHandler.on_message.assert_called_with(data)
    BaseWebSocketHandler.on_close.assert_called()
