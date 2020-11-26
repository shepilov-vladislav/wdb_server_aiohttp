# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member
# Thirdparty:
import pytest

# Firstparty:
from wdb_server.utils.state import SyncWebSockets


@pytest.fixture
def syncwebsockets():
    return SyncWebSockets()


async def test_add(mocker, dummy_websocket, syncwebsockets):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")

    assert "dummy_syncwebsocket" not in syncwebsockets._sockets
    await syncwebsockets.add("dummy_syncwebsocket", dummy_websocket)
    assert syncwebsockets._sockets == {"dummy_syncwebsocket": dummy_websocket}
    SyncWebSockets.broadcast.assert_not_called()
