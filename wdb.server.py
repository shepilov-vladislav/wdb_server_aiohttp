#!/usr/bin/env python

# Stdlib:
import argparse
from logging import DEBUG, INFO, WARNING, getLogger

# Thirdparty:
import uvloop
from aiomisc import entrypoint

# Firstparty:
from wdb_server.__main__ import WDBService, WDBTCPService


# pylint: disable=missing-function-docstring
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--debug", action="store_true", help="Debug mode (default False)"
    )
    parser.add_argument(
        "--extra-search-path",
        action="store_true",
        help=(
            "Try harder to find the 'libpython*' shared library at the cost "
            "of a slower server startup. (default False)"
        ),
    )
    parser.add_argument(
        "--more",
        action="store_true",
        help="Set the debug more verbose (default False)",
    )
    parser.add_argument(
        "--detached_session",
        action="store_true",
        help="Whether to continue program on browser close (default False)",
    )
    parser.add_argument(
        "--show-filename",
        action="store_true",
        help="Whether to show filename in session list (default False)",
    )
    parser.add_argument(
        "--server-host",
        type=str,
        default="localhost",
        help="Host used to serve debugging pages (default localhost)",
    )
    parser.add_argument(
        "--server-port",
        type=int,
        default=1984,
        help="Port used to serve debugging pages (default 1984)",
    )
    parser.add_argument(
        "--socket-host",
        type=str,
        default="localhost",
        help="Host used to communicate with wdb instances (default localhost)",
    )
    parser.add_argument(
        "--socket-port",
        type=int,
        default=19840,
        help="Port used to communicate with wdb instances (default 19840)",
    )
    args = parser.parse_args()

    log = getLogger("wdb_server")

    if args.debug:
        log.setLevel(INFO)
        if args.more:
            log.setLevel(DEBUG)
    else:
        log.setLevel(WARNING)

    uvloop.install()

    services = (
        WDBService(
            address=args.server_host, port=args.server_port, **vars(args)
        ),
        WDBTCPService(address=args.socket_host, port=args.socket_port),
    )

    with entrypoint(*services) as loop:
        try:
            loop.run_forever()
        except KeyboardInterrupt:
            print("Received exit, exiting")


if __name__ == "__main__":
    main()
