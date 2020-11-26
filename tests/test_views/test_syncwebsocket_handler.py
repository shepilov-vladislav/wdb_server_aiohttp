# pylint: disable=missing-function-docstring,invalid-name,protected-access
# pylint: disable=redefined-outer-name,too-many-statements

# Stdlib:
import asyncio
import json
import os

# Thirdparty:
import mock
import pytest
from mock import call

# Firstparty:
import wdb_server
from wdb_server.utils.state import (
    Sockets,
    SyncWebSockets,
    WebSockets,
    breakpoints,
    settings,
    sockets,
    websockets,
)
from wdb_server.utils.technical import LibPythonWatcher
from wdb_server.views import (
    BaseWebSocketHandler,
    run_file,
    run_shell,
    self_shell,
)

TEST_UUID = "TEST_UUID"


@pytest.fixture()
def refresh_process():
    with mock.patch.object(
        wdb_server.views, "refresh_process", return_value=None
    ) as mock_method:
        yield mock_method


async def test_open_close(mocker, client):
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_open")
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_message")
    mocker.patch("wdb_server.views.BaseWebSocketHandler.on_close")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.add")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.send")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.remove")

    uuid = None
    async with client.ws_connect("/status"):
        BaseWebSocketHandler.on_open.assert_not_called()
        BaseWebSocketHandler.on_message.assert_not_called()
        BaseWebSocketHandler.on_close.assert_not_called()
        SyncWebSockets.add.assert_called_once()
        uuid = SyncWebSockets.add.call_args[0][0]
        instance = SyncWebSockets.add.call_args[0][1]
        if not LibPythonWatcher:
            SyncWebSockets.send.assert_called_with(uuid, "StartLoop")
        assert instance.uuid == uuid
    SyncWebSockets.remove.assert_called_with(uuid)


async def test_write(mocker, client):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.add")

    async with client.ws_connect("/status") as ws:
        instance = SyncWebSockets.add.call_args[0][1]
        message = "message"
        await instance.write(message)
        received = await ws.receive_str()
        assert message == received


async def test_on_message(
    mocker,
    client,
    dummy_socket,
    refresh_process,
    Process___init__,
    Process_start,
    create_subprocess_exec,
):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.add")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.send")

    def clean_mocks():
        SyncWebSockets.add.reset_mock()
        SyncWebSockets.send.reset_mock()
        Process___init__.reset_mock()
        Process_start.reset_mock()

    async def send_to_websocket(cmd, message=None):
        data = f"{cmd}|{message}" if message is not None else cmd
        async with client.ws_connect("/status") as ws:
            uuid = SyncWebSockets.add.call_args[0][0]
            clean_mocks()
            await ws.send_str(data)
        return uuid

    # ListSockets
    sockets._sockets = {"socket1": dummy_socket, "socket2": dummy_socket}
    sockets._filenames = {"socket1": "filename1", "socket2": "filename2"}

    settings.show_filename = False
    uuid = await send_to_websocket("ListSockets")

    assert not settings.show_filename
    assert SyncWebSockets.send.call_count == 2
    assert (
        call(uuid, "AddSocket", {"uuid": "socket1", "filename": ""})
        in SyncWebSockets.send.mock_calls
    )
    assert (
        call(uuid, "AddSocket", {"uuid": "socket2", "filename": ""})
        in SyncWebSockets.send.mock_calls
    )

    settings.show_filename = True
    uuid = await send_to_websocket("ListSockets")

    assert settings.show_filename
    assert SyncWebSockets.send.call_count == 2
    assert (
        call(uuid, "AddSocket", {"uuid": "socket1", "filename": "filename1"})
        in SyncWebSockets.send.mock_calls
    )
    assert (
        call(uuid, "AddSocket", {"uuid": "socket2", "filename": "filename2"})
        in SyncWebSockets.send.mock_calls
    )

    # ListWebsockets
    websockets._sockets = {
        "websocket1": dummy_socket,
        "websocket2": dummy_socket,
    }

    uuid = await send_to_websocket("ListWebsockets")

    assert SyncWebSockets.send.call_count == 2
    assert (
        call(uuid, "AddWebSocket", "websocket1")
        in SyncWebSockets.send.mock_calls
    )
    assert (
        call(uuid, "AddWebSocket", "websocket2")
        in SyncWebSockets.send.mock_calls
    )

    # ListBreaks
    breakpoints._breakpoints = ["breakpoint1", "breakpoint2"]

    uuid = await send_to_websocket("ListBreaks")

    assert SyncWebSockets.send.call_count == 2
    assert (
        call(uuid, "AddBreak", "breakpoint1") in SyncWebSockets.send.mock_calls
    )
    assert (
        call(uuid, "AddBreak", "breakpoint2") in SyncWebSockets.send.mock_calls
    )

    # RemoveBreak
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    mocker.patch("wdb_server.utils.state.Sockets.broadcast")
    breakpoint1 = {"data": "breakpoint1", "temporary": None}
    breakpoint2 = {"data": "breakpoint2", "temporary": None}
    breakpoints._breakpoints = [breakpoint1, breakpoint2]

    uuid = await send_to_websocket("RemoveBreak", json.dumps(breakpoint1))

    SyncWebSockets.broadcast.assert_called_with(
        f"RemoveBreak|{json.dumps(breakpoint1)}"
    )
    Sockets.broadcast.assert_called_with(
        "Unbreak", breakpoint1 | {"temporary": False}
    )
    assert breakpoint1 not in breakpoints.get()

    # RemoveUUID
    mocker.patch("wdb_server.utils.state.Sockets.close")
    mocker.patch("wdb_server.utils.state.Sockets.remove")
    mocker.patch("wdb_server.utils.state.WebSockets.close")
    mocker.patch("wdb_server.utils.state.WebSockets.remove")

    test_uuid = "test_uuid"
    uuid = await send_to_websocket("RemoveUUID", test_uuid)

    Sockets.close.assert_called_with(test_uuid)
    Sockets.remove.assert_called_with(test_uuid)
    WebSockets.close.assert_called_with(test_uuid)
    WebSockets.remove.assert_called_with(test_uuid)

    # ListProcesses
    uuid = await send_to_websocket("ListProcesses")
    refresh_process.assert_called_once_with(uuid)

    # Pause
    uuid = await send_to_websocket("Pause", os.getpid())
    Process___init__.assert_called_once_with(target=self_shell)
    Process_start.assert_called_once()

    pid = 11111111111111
    uuid = await send_to_websocket("Pause", pid)
    create_subprocess_exec.assert_called_once_with(
        "gdb",
        "-p",
        str(pid),
        "-batch",
        "-eval-command=call PyGILState_Ensure()",
        '-eval-command=call PyRun_SimpleString("import wdb; wdb.set_trace(skip=1)")',
        "-eval-command=call PyGILState_Release($1)",
        stdin=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # RunFile
    fname = "test.py"
    uuid = await send_to_websocket("RunFile", fname)
    Process___init__.assert_called_once_with(target=run_file, args=(fname,))
    Process_start.assert_called_once()

    # RunShell
    uuid = await send_to_websocket("RunShell")
    Process___init__.assert_called_once_with(target=run_shell)
    Process_start.assert_called_once()
