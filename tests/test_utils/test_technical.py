# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,missing-class-docstring
# pylint: disable=too-few-public-methods,too-many-instance-attributes
# pylint: disable=too-many-arguments
# Thirdparty:
import psutil
from mock import call

# Firstparty:
from wdb_server.utils.state import SyncWebSockets
from wdb_server.utils.technical import refresh_process


class PsutilProcessThreadMock:
    __slots__ = ["id"]

    # pylint: disable=invalid-name
    def __init__(self, _id):
        self.id = _id


class PsutilProcessMock:
    __slots__ = [
        "pid",
        "_cmdline",
        "_cpu_percent",
        "_username",
        "_threads",
        "_create_time",
        "_memory_percent",
        "_is_running",
        "_status",
    ]

    def __init__(
        self,
        pid,
        cmdline,
        cpu_percent,
        username,
        threads,
        create_time,
        memory_percent,
        is_running=True,
        status=psutil.STATUS_IDLE,
    ):
        self.pid = pid
        self._cmdline = cmdline
        self._cpu_percent = cpu_percent
        self._username = username
        self._threads = threads
        self._create_time = create_time
        self._memory_percent = memory_percent
        self._is_running = is_running
        self._status = status

    def cmdline(self):
        if isinstance(self._cmdline, psutil.Error):
            raise self._cmdline
        return self._cmdline

    # pylint: disable=unused-argument
    def cpu_percent(self, interval=0.01):
        if isinstance(self._cpu_percent, psutil.Error):
            raise self._cpu_percent
        return self._cpu_percent

    def username(self):
        return self._username

    def num_threads(self):
        return len(self._threads)

    def create_time(self):
        return self._create_time

    def memory_percent(self):
        return self._memory_percent

    def threads(self):
        return self._threads

    def is_running(self):
        return self._is_running

    def status(self):
        return self._status


def mock_process_iter(result):
    for item in result:
        yield item


empty_process = PsutilProcessMock(
    pid=1,
    cmdline=[],
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
not_python_process = PsutilProcessMock(
    pid=2,
    cmdline=["/usr/bin/binary", "test"],
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
python_process_without_threads = PsutilProcessMock(
    pid=3,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
python_process_with_threads = PsutilProcessMock(
    pid=4,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=0.0,
    username="user",
    threads=[PsutilProcessThreadMock(1), PsutilProcessThreadMock(2)],
    create_time=1,
    memory_percent=1.1,
)
zombie_process = PsutilProcessMock(
    pid=5,
    cmdline=psutil.ZombieProcess(5),
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
access_denied_process = PsutilProcessMock(
    pid=6,
    cmdline=psutil.AccessDenied(),
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
no_such_process = PsutilProcessMock(
    pid=7,
    cmdline=psutil.NoSuchProcess(7),
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
zombie_process2 = PsutilProcessMock(
    pid=8,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=0.0,
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
    status=psutil.STATUS_ZOMBIE,
)
no_such_process2 = PsutilProcessMock(
    pid=9,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=psutil.NoSuchProcess(9),
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
access_denied_process2 = PsutilProcessMock(
    pid=10,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=psutil.AccessDenied(),
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)
unknown_error_process = PsutilProcessMock(
    pid=10,
    cmdline=["/usr/bin/python3.9", "test.py"],
    cpu_percent=psutil.Error(),
    username="user",
    threads=[],
    create_time=1,
    memory_percent=1.1,
)

expected_calls = [
    (
        "AddProcess",
        {
            "pid": python_process_without_threads.pid,
            "user": python_process_without_threads._username,
            "cmd": " ".join(python_process_without_threads._cmdline),
            "threads": len(python_process_without_threads._threads),
            "time": python_process_without_threads._create_time,
            "mem": python_process_without_threads._memory_percent,
            "cpu": python_process_without_threads._cpu_percent,
        },
    ),
    (
        "AddProcess",
        {
            "pid": python_process_with_threads.pid,
            "user": python_process_with_threads._username,
            "cmd": " ".join(python_process_with_threads._cmdline),
            "threads": len(python_process_with_threads._threads),
            "time": python_process_with_threads._create_time,
            "mem": python_process_with_threads._memory_percent,
            "cpu": python_process_with_threads._cpu_percent,
        },
    ),
    (
        "AddThread",
        {
            "id": python_process_with_threads._threads[0].id,
            "of": python_process_with_threads.pid,
        },
    ),
    (
        "AddThread",
        {
            "id": python_process_with_threads._threads[1].id,
            "of": python_process_with_threads.pid,
        },
    ),
    (
        "KeepProcess",
        [
            python_process_without_threads.pid,
            python_process_with_threads.pid,
        ],
    ),
    (
        "KeepThreads",
        [
            python_process_with_threads._threads[0].id,
            python_process_with_threads._threads[1].id,
        ],
    ),
]


async def test_refresh_process_without_uuid(mocker):
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.send")
    mock_processes = [
        empty_process,
        not_python_process,
        python_process_without_threads,
        python_process_with_threads,
        zombie_process,
        access_denied_process,
        no_such_process,
        zombie_process2,
        access_denied_process2,
        no_such_process2,
        unknown_error_process,
    ]
    mocker.patch(
        "psutil.process_iter", return_value=mock_process_iter(mock_processes)
    )
    await refresh_process()
    SyncWebSockets.send.assert_not_called()
    assert SyncWebSockets.broadcast.call_count == 6
    assert SyncWebSockets.broadcast.mock_calls == [
        call(*x) for x in expected_calls
    ]


async def test_refresh_process_with_uuid(mocker):
    test_uuid = "test_uuid"
    mocker.patch("wdb_server.utils.state.SyncWebSockets.broadcast")
    mocker.patch("wdb_server.utils.state.SyncWebSockets.send")
    mock_processes = [
        empty_process,
        not_python_process,
        python_process_without_threads,
        python_process_with_threads,
        zombie_process,
        access_denied_process,
        no_such_process,
        zombie_process2,
        access_denied_process2,
        no_such_process2,
        unknown_error_process,
    ]
    mocker.patch(
        "psutil.process_iter", return_value=mock_process_iter(mock_processes)
    )
    await refresh_process(test_uuid)
    SyncWebSockets.broadcast.assert_not_called()
    assert SyncWebSockets.send.call_count == 6
    assert SyncWebSockets.send.mock_calls == [
        call(test_uuid, *x) for x in expected_calls
    ]
