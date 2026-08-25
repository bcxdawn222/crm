from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType
from typing import TypedDict
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SMOKE_SCRIPT = ROOT / "scripts" / "smoke-http.py"


class SessionUserFixture(TypedDict):
    id: str
    roles: list[str]
    permissions: list[str]


class SessionFixture(TypedDict):
    user: SessionUserFixture


def load_smoke_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("crm_smoke_http", SMOKE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载冒烟脚本: {SMOKE_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class SmokeScriptTests(unittest.TestCase):
    @staticmethod
    def session_fixture() -> SessionFixture:
        return {
            "user": {
                "id": "smoke-user",
                "roles": ["admin"],
                "permissions": ["customer:view"],
            }
        }

    def test_main_parses_unauthenticated_json_before_login(self) -> None:
        smoke = load_smoke_module()
        login_page = smoke.HttpResult(200, f"{smoke.BASE_URL}/login", {}, b"")
        protected = smoke.HttpResult(
            401,
            f"{smoke.BASE_URL}/api/customers",
            {},
            b'{"success":false,"requestId":"smoke-test-request"}',
        )
        login_result = smoke.HttpResult(200, smoke.BASE_URL, {}, b"")
        session = self.session_fixture()

        with patch.object(smoke, "build_opener", side_effect=(Mock(), Mock(), Mock())), patch.object(
            smoke, "request", side_effect=(login_page, protected)
        ), patch.object(smoke, "login", return_value=login_result), patch.object(
            smoke, "get_session", side_effect=({}, session)
        ), patch.object(smoke, "assert_api_success"):
            self.assertEqual(smoke.main(), 0)

    def test_main_can_skip_invalid_login_check(self) -> None:
        smoke = load_smoke_module()
        login_page = smoke.HttpResult(200, f"{smoke.BASE_URL}/login", {}, b"")
        protected = smoke.HttpResult(
            401,
            f"{smoke.BASE_URL}/api/customers",
            {},
            b'{"success":false,"requestId":"smoke-test-request"}',
        )
        login_result = smoke.HttpResult(200, smoke.BASE_URL, {}, b"")

        with patch.object(smoke, "VERIFY_INVALID_LOGIN", False), patch.object(
            smoke, "build_opener", side_effect=(Mock(), Mock())
        ), patch.object(smoke, "request", side_effect=(login_page, protected)), patch.object(
            smoke, "login", return_value=login_result
        ) as login_mock, patch.object(
            smoke, "get_session", return_value=self.session_fixture()
        ), patch.object(smoke, "assert_api_success"):
            self.assertEqual(smoke.main(), 0)
            login_mock.assert_called_once_with(unittest.mock.ANY, smoke.USERNAME, smoke.PASSWORD)


if __name__ == "__main__":
    raise SystemExit(unittest.main(verbosity=2))
