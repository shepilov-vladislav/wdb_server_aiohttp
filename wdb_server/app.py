# Stdlib:
import logging
import sys
from json import JSONDecodeError
from pathlib import Path
from typing import Any, Dict

# Aiohttp:
from aiohttp import ClientSession, ServerTimeoutError, web

# Thirdparty:
import aiohttp_jinja2
import jinja2

# Firstparty:
import wdb_server
from wdb_server.constants import MDL_THEMES_DIR, PROJECT_DIR
from wdb_server.routes import init_routes
from wdb_server.utils.state import settings as settings_store
from wdb_server.utils.technical import LibPythonWatcher


def get_mdl_themes() -> Dict[str, Path]:
    """
    Function for get all available mdl themes
    """
    themes = {
        str(theme.name)
        .replace("material.", "")
        .replace(".min.css", ""): theme.resolve()
        for theme in MDL_THEMES_DIR.glob("material.*-*.min.css")
    }
    return themes


async def request_processor(request: web.Request) -> Dict[str, Any]:
    """
    Add request and current handler to context of Jinja2
    """
    return {
        "request": request,
        # pylint: disable=protected-access
        "handler": request.match_info.route._handler,
    }


def init_themes(app: web.Application) -> None:
    """
    Initialize themes for application.
    """
    app["themes"] = get_mdl_themes()
    app["theme"] = {
        "home": "red-deep_orange",
        "pm": "red-indigo",
        "shell": "teal-orange",
        "debug": "indigo-red",
    }


async def init_versions(app: web.Application) -> None:
    """
    Initialize current version and version from PYPI
    """
    async with ClientSession(timeout=1) as session:
        try:
            async with session.get(
                "https://pypi.org/pypi/wdb.server.aiohttp/json"
            ) as resp:
                info = await resp.json()
                pypi_version = info["info"]["version"]
                app["pypi_version"] = pypi_version
        except ServerTimeoutError:
            app["pypi_version"] = "pypi_error"
        except JSONDecodeError:
            app["pypi_version"] = "parsing_error"
        except Exception:  # pylint: disable=broad-except
            app["pypi_version"] = "unknown_error"
    app["version"] = wdb_server.__version__
    new_version = False
    if app["pypi_version"] not in (
        "pypi_error",
        "parsing_error",
        "unknown_error",
        app["version"],
    ):
        new_version = app["pypi_version"]
    app["new_version"] = new_version


def init_jinja2(app: web.Application) -> None:
    """
    Initialize jinja2 template for application.
    """
    aiohttp_jinja2.setup(
        app,
        context_processors=[
            request_processor,
            aiohttp_jinja2.request_processor,
        ],
        loader=jinja2.FileSystemLoader(str(PROJECT_DIR / "templates")),
        default_helpers=True,
    )
    app["static_root_url"] = "/static"
    env = aiohttp_jinja2.get_env(app)
    env.globals.update(themes=app["themes"].keys())


async def init_app(settings: Dict[str, Any]) -> web.Application:
    """
    This function will create an application instance
    """
    if LibPythonWatcher:  # pragma: no cover
        LibPythonWatcher(
            sys.base_prefix if settings["extra_search_path"] else None
        )

    app = web.Application()

    settings_store.update(**settings)
    app["settings"] = settings_store

    logging.basicConfig(level=logging.DEBUG)
    await init_versions(app)
    init_themes(app)
    init_jinja2(app)
    init_routes(app)

    return app
