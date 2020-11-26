# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name
# Stdlib:
from uuid import uuid4


async def test_main_get(client):
    unknown_type = "unknown"
    bad_uuid = "bad_uuid"

    resp = await client.get(f"/{unknown_type}/session/{uuid4()}")
    assert resp.status == 404
    assert resp.reason == f"type_ {unknown_type} Not Found"

    resp = await client.get(f"/debug/session/{bad_uuid}")
    assert resp.status == 404
    assert resp.reason == "Not Found"

    type_ = "debug"
    uuid = uuid4()
    resp = await client.get(f"/{type_}/session/{uuid}")
    assert resp.status == 200
    text = await resp.text()
    assert f'<body data-debug="true" data-type="{type_}">' in text
    assert (
        '<div class="trace mdl-layout mdl-js-layout mdl-layout--fixed-header"'
        f' data-uuid="{uuid}">' in text
    )
