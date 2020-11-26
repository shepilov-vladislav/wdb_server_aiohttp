# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member
# Thirdparty:
import pytest
from mock import call

# Firstparty:
from conftest import DummyWebSocket
from wdb_server.utils.state import SyncWebSockets, WebSockets


@pytest.fixture
def websockets():
    return WebSockets()


async def test_add(mocker, dummy_websocket, websockets):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")

    assert "dummy_websocket" not in websockets._sockets
    await websockets.add("dummy_websocket", dummy_websocket)
    assert websockets._sockets == {"dummy_websocket": dummy_websocket}
    SyncWebSockets.broadcast.assert_called_once_with(
        "AddWebSocket", "dummy_websocket"
    )


async def test_send(mocker, dummy_websocket, websockets):
    mocker.patch.object(DummyWebSocket, "write_message")
    await websockets.add("dummy_websocket", dummy_websocket)

    dummy_websocket.ws = "ws"
    assert hasattr(dummy_websocket, "ws")
    data = "data"
    await websockets.send("dummy_websocket", data)
    assert DummyWebSocket.write_message.mock_calls == [call(data)]

    delattr(dummy_websocket, "ws")
    assert not hasattr(dummy_websocket, "ws")
    DummyWebSocket.write_message.reset_mock()
    await websockets.send("dummy_websocket", data)
    assert DummyWebSocket.write_message.mock_calls == []
