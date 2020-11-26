# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member, missing-class-docstring
# Thirdparty:
import pytest

# Firstparty:
from wdb_server.utils.state import Breakpoints, SyncWebSockets


@pytest.fixture
def breakpoints():
    return Breakpoints()


async def test_add(mocker, breakpoints):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    dummy_breakpoint = "dummy_breakpoint"
    assert breakpoints._breakpoints == []
    await breakpoints.add(dummy_breakpoint)
    assert breakpoints._breakpoints == [dummy_breakpoint]

    SyncWebSockets.broadcast.assert_called_once_with(
        f'AddBreak|"{dummy_breakpoint}"'
    )

    assert breakpoints._breakpoints == [dummy_breakpoint]
    await breakpoints.add(dummy_breakpoint)
    assert breakpoints._breakpoints == [dummy_breakpoint]


async def test_remove(mocker, breakpoints):
    dummy_breakpoint = "dummy_breakpoint"
    await breakpoints.add(dummy_breakpoint)
    assert breakpoints._breakpoints == [dummy_breakpoint]

    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")

    await breakpoints.remove(dummy_breakpoint)
    assert breakpoints._breakpoints == []

    SyncWebSockets.broadcast.assert_called_once_with(
        f'RemoveBreak|"{dummy_breakpoint}"'
    )

    SyncWebSockets.broadcast.reset_mock()
    await breakpoints.remove(dummy_breakpoint)
    assert breakpoints._breakpoints == []
    SyncWebSockets.broadcast.assert_not_called()


async def test_get(breakpoints):
    await breakpoints.add("dummy_breakpoint1")
    await breakpoints.add("dummy_breakpoint2")
    assert breakpoints._breakpoints == [
        "dummy_breakpoint1",
        "dummy_breakpoint2",
    ]

    assert (
        breakpoints.get()
        == ["dummy_breakpoint1", "dummy_breakpoint2"]
        == breakpoints._breakpoints
    )
