# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name


async def test_home_get(client):
    resp = await client.get("/")
    assert resp.status == 200


async def test_home_post(client):
    theme_original = client.app["theme"]
    assert theme_original == {
        "home": "red-deep_orange",
        "pm": "red-indigo",
        "shell": "teal-orange",
        "debug": "indigo-red",
    }
    test_theme = "test-theme"
    for type_ in ("home", "pm", "shell", "debug"):
        resp = await client.post("/", data={f"theme_{type_}": test_theme})
        assert resp.status == 200
        assert client.app["theme"] == theme_original | {type_: test_theme}
        client.app["theme"] = theme_original
