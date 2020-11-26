# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member
# Stdlib:
import json

# Thirdparty:
import pytest
from mock import call

# Firstparty:
from conftest import DummySocket
from wdb_server.utils.state import BaseSockets, SyncWebSockets


@pytest.fixture
def base_sockets():
    return BaseSockets()


async def test_send(mocker, dummy_socket, base_sockets):
    mocker.patch("wdb_server.utils.state.BaseSockets._send")
    data = "data"
    message = "message"
    base_sockets._sockets = {"dummy_socket": dummy_socket}

    await base_sockets.send("anotheere_dummy_socket", data, message)
    BaseSockets._send.assert_not_called()

    await base_sockets.send("dummy_socket", data)
    BaseSockets._send.assert_called_once_with(dummy_socket, data)

    BaseSockets._send.reset_mock()
    await base_sockets.send("dummy_socket", data, message)
    BaseSockets._send.assert_called_once_with(
        dummy_socket, f"{data}|{json.dumps(message)}"
    )


async def test_add(mocker, dummy_socket, base_sockets):
    mocker.patch("wdb_server.utils.state.BaseSockets.remove")
    mocker.patch("wdb_server.utils.state.BaseSockets.close")

    assert "dummy_socket" not in base_sockets._sockets
    await base_sockets.add("dummy_socket", dummy_socket)
    BaseSockets.remove.assert_not_called()
    BaseSockets.close.assert_not_called()

    assert "dummy_socket" in base_sockets._sockets
    assert base_sockets._sockets == {"dummy_socket": dummy_socket}
    await base_sockets.add("dummy_socket", dummy_socket)
    BaseSockets.remove.assert_called_once_with("dummy_socket")
    BaseSockets.close.assert_called_once_with("dummy_socket")


async def test_remove(mocker, dummy_socket, base_sockets):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    assert "dummy_socket" not in base_sockets._sockets
    await base_sockets.remove("dummy_socket")
    SyncWebSockets.broadcast.assert_not_called()

    base_sockets._sockets = {"dummy_socket": dummy_socket}
    assert "dummy_socket" in base_sockets._sockets
    await base_sockets.remove("dummy_socket")
    SyncWebSockets.broadcast.assert_called_once_with(
        "RemoveBaseSocket", "dummy_socket"
    )


async def test_close(mocker, dummy_socket, base_sockets):
    mocker.patch.object(DummySocket, "close")

    assert "dummy_socket" not in base_sockets._sockets
    await base_sockets.close("dummy_socket")
    DummySocket.close.assert_not_called()

    base_sockets._sockets = {"dummy_socket": dummy_socket}
    assert "dummy_socket" in base_sockets._sockets

    DummySocket.close.side_effect = Exception("error")
    DummySocket.close.assert_not_called()

    await base_sockets.close("dummy_socket")
    DummySocket.close.assert_called_once()


def test_uuids(dummy_socket, base_sockets):
    assert base_sockets.uuids == set()

    base_sockets._sockets = {"dummy_socket": dummy_socket}
    assert base_sockets.uuids == {"dummy_socket"}

    base_sockets._sockets = {
        "dummy_socket": dummy_socket,
        "another_dummy_socket": dummy_socket,
    }
    assert base_sockets.uuids == {"dummy_socket", "another_dummy_socket"}


async def test_broadcast(mocker, dummy_socket, base_sockets):
    mocker.patch("wdb_server.utils.state.BaseSockets.send")
    mocker.patch("wdb_server.utils.state.BaseSockets.close")
    mocker.patch("wdb_server.utils.state.BaseSockets.remove")

    base_sockets._sockets = {"dummy_socket": dummy_socket}

    cmd = "cmd"
    message = "message"
    await base_sockets.broadcast(cmd, message)
    BaseSockets.send.assert_called_once_with("dummy_socket", cmd, message)
    BaseSockets.close.assert_not_called()
    BaseSockets.remove.assert_not_called()

    BaseSockets.send.reset_mock()
    base_sockets._sockets = {
        "dummy_socket": dummy_socket,
        "another_dummy_socket": dummy_socket,
    }
    await base_sockets.broadcast(cmd, message)
    assert BaseSockets.send.call_count == 2
    assert BaseSockets.send.mock_calls == [
        call("dummy_socket", cmd, message),
        call("another_dummy_socket", cmd, message),
    ]
    BaseSockets.close.assert_not_called()
    BaseSockets.remove.assert_not_called()

    BaseSockets.send.reset_mock()
    BaseSockets.send.side_effect = [True, Exception("error")]
    await base_sockets.broadcast(cmd, message)
    assert BaseSockets.send.call_count == 2
    assert BaseSockets.send.mock_calls == [
        call("dummy_socket", cmd, message),
        call("another_dummy_socket", cmd, message),
    ]
    BaseSockets.close.assert_called_once_with("another_dummy_socket")
    BaseSockets.remove.assert_called_once_with("another_dummy_socket")
