# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member
# Thirdparty:
import pytest
from mock import call

# Firstparty:
from conftest import DummySocket
from wdb_server.utils.state import Sockets, SyncWebSockets, settings


@pytest.fixture
def sockets():
    return Sockets()


async def test_add(mocker, dummy_socket, sockets):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")

    assert "dummy_socket" not in sockets._sockets
    await sockets.add("dummy_socket", dummy_socket)
    assert sockets._sockets == {"dummy_socket": dummy_socket}
    SyncWebSockets.broadcast.assert_called_once_with(
        "AddSocket", {"uuid": "dummy_socket"}
    )


async def test_remove(dummy_socket, sockets):
    assert "dummy_socket" not in sockets._sockets
    assert "dummy_socket" not in sockets._filenames

    sockets._sockets = {"dummy_socket": dummy_socket}
    sockets._filenames = {"dummy_socket": "dummy_socket.file"}

    assert "dummy_socket" in sockets._sockets
    assert "dummy_socket" in sockets._filenames

    await sockets.remove("dummy_socket")
    assert "dummy_socket" not in sockets._sockets
    assert "dummy_socket" not in sockets._filenames


def test_get_filename(sockets):
    assert "dummy_socket" not in sockets._filenames

    assert sockets.get_filename("dummy_socket") == ""

    sockets._filenames = {"dummy_socket": "dummy_socket.file"}
    assert "dummy_socket" in sockets._filenames
    assert sockets.get_filename("dummy_socket") == "dummy_socket.file"


async def test_set_filename(mocker, sockets):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    assert "dummy_socket" not in sockets._filenames

    assert settings.show_filename
    await sockets.set_filename("dummy_socket", "dummy_socket.file")
    assert "dummy_socket" in sockets._filenames
    assert sockets._filenames == {"dummy_socket": "dummy_socket.file"}
    SyncWebSockets.broadcast.assert_called_once_with(
        "AddSocket", {"filename": "dummy_socket.file", "uuid": "dummy_socket"}
    )

    settings.show_filename = False
    assert not settings.show_filename
    SyncWebSockets.broadcast.reset_mock()
    sockets._filenames = {}
    await sockets.set_filename("dummy_socket", "dummy_socket.file")
    assert "dummy_socket" in sockets._filenames
    assert sockets._filenames == {"dummy_socket": "dummy_socket.file"}
    SyncWebSockets.broadcast.assert_called_once_with(
        "AddSocket", {"filename": "", "uuid": "dummy_socket"}
    )


async def test_send(mocker, dummy_socket, sockets):
    mocker.patch.object(DummySocket, "write")
    await sockets.add("dummy_socket", dummy_socket)
    data = "data"
    message = "message"
    await sockets.send("dummy_socket", data)
    assert DummySocket.write.mock_calls == [
        call(b"\x00\x00\x00\x04"),
        call(data.encode("utf-8")),
    ]

    DummySocket.write.reset_mock()
    await sockets.send("dummy_socket", data, message)
    assert DummySocket.write.mock_calls == [
        call(b"\x00\x00\x00\x0e"),
        call(f'{data}|"{message}"'.encode("utf-8")),
    ]
