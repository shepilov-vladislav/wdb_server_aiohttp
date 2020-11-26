# pylint: disable=missing-class-docstring
# pylint: disable=missing-function-docstring
# pylint: disable=unsubscriptable-object
# Stdlib:
import asyncio
import logging
from glob import glob
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Thirdparty:
import psutil

# Firstparty:
from wdb_server.utils.state import syncwebsockets

log = logging.getLogger("wdb_server")

try:
    # Thirdparty:
    import pyinotify
except ImportError:
    LibPythonWatcher = None  # pylint: disable=invalid-name
else:

    class LibPythonWatcher:  # type: ignore # pragma: no cover
        def __init__(self, extra_search_path: str = None) -> None:
            inotify = pyinotify.WatchManager()
            self.files = glob("/usr/lib/libpython*")
            if not self.files:
                self.files = glob("/lib/libpython*")

            if extra_search_path is not None:
                # Handle custom installation paths
                for file in Path(extra_search_path).rglob("libpython*"):
                    self.files.append(str(file.resolve()))

            log.debug("Watching for %s", self.files)
            self.notifier = pyinotify.AsyncioNotifier(
                inotify,
                asyncio.get_event_loop(),
                self.notified,
                pyinotify.ProcessEvent(),
            )
            inotify.add_watch(
                self.files,
                pyinotify.EventsCodes.ALL_FLAGS["IN_OPEN"]
                | pyinotify.EventsCodes.ALL_FLAGS["IN_CLOSE_NOWRITE"],
            )

        # pylint: disable=unused-argument
        async def notified(self, notifier: Any) -> None:
            log.debug("Got notified for %s", self.files)
            await refresh_process()
            log.debug("Process refreshed")

        def close(self) -> None:
            log.debug("Closing for %s", self.files)
            self.notifier.stop()


async def refresh_process(uuid: str = "") -> None:

    if uuid != "":

        async def send(
            data: str,
            message: Optional[Union[Dict[str, Any], List[int], str]] = None,
        ) -> None:
            await syncwebsockets.send(uuid, data, message)

    else:

        async def send(
            data: str,
            message: Optional[Union[Dict[str, Any], List[int], str]] = None,
        ) -> None:
            await syncwebsockets.broadcast(data, message)

    remaining_pids = []
    remaining_tids = []
    for proc in psutil.process_iter():
        try:
            cl = proc.cmdline()  # pylint: disable=invalid-name
        except (
            psutil.ZombieProcess,
            psutil.AccessDenied,
            psutil.NoSuchProcess,
        ):
            continue
        else:
            if len(cl) == 0:
                continue

        binary = cl[0].split("/")[-1]
        if (
            ("python" in binary or "pypy" in binary)
            and proc.is_running()
            and proc.status() != psutil.STATUS_ZOMBIE
        ):
            try:
                try:
                    cpu = proc.cpu_percent(interval=0.01)
                    await send(
                        "AddProcess",
                        {
                            "pid": proc.pid,
                            "user": proc.username(),
                            "cmd": " ".join(proc.cmdline()),
                            "threads": proc.num_threads(),
                            "time": proc.create_time(),
                            "mem": proc.memory_percent(),
                            "cpu": cpu,
                        },
                    )
                    remaining_pids.append(proc.pid)
                    for thread in proc.threads():
                        await send(
                            "AddThread", {"id": thread.id, "of": proc.pid}
                        )
                        remaining_tids.append(thread.id)
                except psutil.NoSuchProcess:
                    pass
                except psutil.AccessDenied:
                    pass
            except Exception:  # pylint: disable=broad-except
                log.warning("", exc_info=True)
                continue

    await send("KeepProcess", remaining_pids)
    await send("KeepThreads", remaining_tids)
