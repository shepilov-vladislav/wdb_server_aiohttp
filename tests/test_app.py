# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,missing-class-docstring
# Stdlib:
import json

# Aiohttp:
from aiohttp import ServerTimeoutError, web

# Thirdparty:
import aiohttp_jinja2
import jinja2

# Firstparty:
import wdb_server
from wdb_server.app import (
    get_mdl_themes,
    init_app,
    init_jinja2,
    init_themes,
    init_versions,
    request_processor,
)
from wdb_server.constants import MDL_THEMES_DIR
from wdb_server.utils.state import settings as settings_store


class MockResponse:
    def __init__(self, text, status=200):
        self._text = text
        self.status = status

    async def text(self):
        if isinstance(self._text, Exception):
            raise self._text
        return self._text

    async def json(self):
        if isinstance(self._text, Exception):
            raise self._text
        return json.loads(self._text)

    # pylint: disable=invalid-name
    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def __aenter__(self):
        return self


def test_get_mdl_themes():
    expected = {
        str(theme.name)
        .replace("material.", "")
        .replace(".min.css", ""): theme.resolve()
        for theme in MDL_THEMES_DIR.glob("material.*-*.min.css")
    }
    assert expected == get_mdl_themes()


async def test_request_processor(aiohttp_client):
    @aiohttp_jinja2.template("tmpl.jinja2")
    async def func(request):  # pylint: disable=unused-argument
        return {}

    app = web.Application(
        middlewares=[aiohttp_jinja2.context_processors_middleware]
    )
    aiohttp_jinja2.setup(
        app,
        loader=jinja2.DictLoader(
            {"tmpl.jinja2": "request: {{ request }}, handler: {{ handler }}, "}
        ),
    )

    app["aiohttp_jinja2_context_processors"] = (
        aiohttp_jinja2.request_processor,
        request_processor,
    )

    app.router.add_get("/", func)

    client = await aiohttp_client(app)

    resp = await client.get("/")
    assert resp.status == 200
    txt = await resp.text()
    assert (
        "request: &lt;Request GET / &gt;, handler: &lt;function "
        "test_request_processor.&lt;locals&gt;.func" in txt
    )


def test_init_themes():
    app = web.Application()
    init_themes(app)
    assert app["themes"] == get_mdl_themes()
    assert app["theme"] == {
        "home": "red-deep_orange",
        "pm": "red-indigo",
        "shell": "teal-orange",
        "debug": "indigo-red",
    }


async def test_init_versions(mocker):
    app = web.Application()
    remote_version = "future_version"
    resp = MockResponse(json.dumps({"info": {"version": remote_version}}), 200)
    mocker.patch("aiohttp.ClientSession.get", return_value=resp)
    await init_versions(app)
    assert app["new_version"] == remote_version
    assert app["pypi_version"] == remote_version
    assert app["version"] == wdb_server.__version__

    resp = MockResponse(
        json.dumps({"info": {"version": wdb_server.__version__}}), 200
    )
    mocker.patch("aiohttp.ClientSession.get", return_value=resp)
    await init_versions(app)
    assert app["new_version"] is False
    assert app["pypi_version"] == wdb_server.__version__
    assert app["version"] == wdb_server.__version__

    resp = MockResponse(ServerTimeoutError())
    mocker.patch("aiohttp.ClientSession.get", return_value=resp)
    await init_versions(app)
    assert app["new_version"] is False
    assert app["pypi_version"] == "pypi_error"
    assert app["version"] == wdb_server.__version__

    resp = MockResponse("badvalue")
    mocker.patch("aiohttp.ClientSession.get", return_value=resp)
    await init_versions(app)
    assert app["new_version"] is False
    assert app["pypi_version"] == "parsing_error"
    assert app["version"] == wdb_server.__version__

    resp = MockResponse(Exception())
    mocker.patch("aiohttp.ClientSession.get", return_value=resp)
    await init_versions(app)
    assert app["new_version"] is False
    assert app["pypi_version"] == "unknown_error"
    assert app["version"] == wdb_server.__version__


def test_init_jinja2():
    app = web.Application()
    init_themes(app)
    init_jinja2(app)
    assert app["static_root_url"] == "/static"
    env = aiohttp_jinja2.get_env(app)
    assert env.globals["themes"] == get_mdl_themes().keys()
    assert env.globals["themes"] == app["themes"].keys()


async def test_init_app():
    test_setings = {
        "debug": True,
        "extra_search_path": True,
        "more": True,
        "show_filename": True,
    }
    app = await init_app(test_setings)
    assert app["settings"] == settings_store
    for key in test_setings:
        assert test_setings[key] == getattr(app["settings"], key)
