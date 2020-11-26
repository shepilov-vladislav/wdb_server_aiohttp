# pylint: disable=missing-function-docstring,invalid-name

# Firstparty:
from wdb_server.views import run_file


async def test_debug_get(client, Process___init__, Process_start):
    test_fname = "test.py"
    resp = await client.get(f"/debug/file/{test_fname}")
    assert resp.status == 200
    Process___init__.assert_called_once_with(
        target=run_file, args=(test_fname,)
    )
    Process_start.assert_called_once()


async def test_debug_post(client, Process___init__, Process_start):
    test_fname = "test.py"
    resp = await client.post("/debug/file/", data={"debug_file": test_fname})
    assert resp.status == 200
    Process___init__.assert_called_once_with(
        target=run_file, args=(test_fname,)
    )
    Process_start.assert_called_once()
