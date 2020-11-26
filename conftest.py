# pylint: disable=unused-argument,missing-function-docstring
# Stdlib:
import asyncio
from typing import Any

# Thirdparty:
import aiomultiprocess
import mock
import pytest

# Firstparty:
from wdb_server.app import init_app


# fixtures
@pytest.fixture
async def client(aiohttp_client):
    """
    The fixture for the initialize client.
    """
    app = await init_app({})

    return await aiohttp_client(app)


class DummySocket:
    """
    Test class for represent any real socket
    """

    async def close(self):
        ...

    async def write(self, data: Any):
        ...


class DummyWebSocket(DummySocket):
    """
    Test class for represent any real websocket
    """

    async def write_message(self, message: str):
        ...


@pytest.fixture
def dummy_socket():
    return DummySocket()


@pytest.fixture
def dummy_websocket():
    return DummyWebSocket()


@pytest.fixture()
def Process___init__():  # pylint: disable=invalid-name
    with mock.patch.object(
        aiomultiprocess.Process, "__init__", return_value=None
    ) as mock_method:
        yield mock_method


@pytest.fixture()
def Process_start():  # pylint: disable=invalid-name
    with mock.patch.object(
        aiomultiprocess.Process, "start", return_value=None
    ) as mock_method:
        yield mock_method


@pytest.fixture()
def create_subprocess_exec():
    with mock.patch.object(
        asyncio, "create_subprocess_exec", return_value=None
    ) as mock_method:
        yield mock_method
