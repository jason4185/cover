import hashlib
import json
import re
import sys

import pytest


CONTRACT = "contracts/cover.py"
GEN = 10**18
NOW = "2026-01-01T00:00:00Z"
NOW_EPOCH = 1767225600
DAY = 24 * 60 * 60
CLAIM_URL = "https://cover-fixtures.netlify.app/claim-covered.json"
COUNTER_URL = "https://cover-fixtures.netlify.app/counterevidence.json"


def warp(vm, value):
    vm.warp(value)
    gl_module = sys.modules.get("genlayer.gl")
    if gl_module is not None and getattr(gl_module, "message_raw", None) is not None:
        gl_module.message_raw["datetime"] = value


def sha256_json(path):
    body = path.read_bytes()
    return hashlib.sha256(body).hexdigest()


def mock_json(vm, url, body, status=200):
    if isinstance(body, str):
        body = body.encode("utf-8")
    vm.mock_web(
        re.escape(url) + r"$",
        {
            "response": {
                "status": status,
                "headers": {"Content-Type": b"application/json"},
                "body": body,
            },
            "method": "GET",
        },
    )


def mock_fixture(vm, name, url):
    path = __file__.replace("conftest.py", "fixtures/" + name)
    with open(path, "rb") as handle:
        body = handle.read()
    mock_json(vm, url, body)
    return hashlib.sha256(body).hexdigest()


def mock_judgment(vm, outcome, reason):
    vm.mock_llm(r"COVER V1", json.dumps({"outcome": outcome, "reason_code": reason}))


@pytest.fixture(autouse=True)
def enable_storage_pickling_checks(request):
    if "direct_vm" not in request.fixturenames:
        yield
        return
    try:
        direct_vm = request.getfixturevalue("direct_vm")
    except pytest.FixtureLookupError:
        yield
        return
    direct_vm.check_pickling = True
    yield


def pytest_collection_modifyitems(config, items):
    has_direct_plugin = any(
        "gltest.direct.pytest_plugin" in getattr(plugin, "__name__", "")
        or "gltest.direct.pytest_plugin" in getattr(plugin, "__module__", "")
        for plugin in config.pluginmanager.get_plugins()
    )
    if has_direct_plugin:
        return
    skip = pytest.mark.skip(reason="GenLayer direct/consensus VM fixtures are not installed")
    for item in items:
        if "direct_vm" in item.fixturenames or "direct_deploy" in item.fixturenames:
            item.add_marker(skip)
