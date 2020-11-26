# Aiohttp:
from aiohttp import web

# Firstparty:
from wdb_server.constants import PROJECT_DIR, UUID_REGEXP
from wdb_server.views import (
    DebugHandler,
    HomeHandler,
    MainHandler,
    SyncWebSocketHandler,
    WebSocketHandler,
)


def init_routes(app: web.Application) -> None:
    """
    Initialization all routes for wdb server.
    """
    add_route = app.router.add_route

    add_route("*", r"/", HomeHandler, name="home")
    add_route(
        "*",
        fr"/{{type_:(\w+)}}/session/{{uuid:{UUID_REGEXP}}}",
        MainHandler,
        name="main",
    )
    add_route("*", r"/debug/file/{fn:(.*)}", DebugHandler, name="debug")
    add_route(
        "*", r"/websocket/{uuid:(.+)}", WebSocketHandler, name="websocket"
    )
    add_route("*", r"/status", SyncWebSocketHandler, name="status")

    # added static dir
    app.router.add_static(
        "/static/",
        path=(PROJECT_DIR / "static"),
        name="static",
    )
