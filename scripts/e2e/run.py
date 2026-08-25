from __future__ import annotations

import os
import secrets
import subprocess
import sys
from pathlib import Path
from uuid import uuid4


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from runtime.mysql_client import parse_database_url


def run(command: list[str], environment: dict[str, str]) -> int:
    executable = command.copy()
    if os.name == "nt" and executable[0] in {"npm", "npx"}:
        executable[0] += ".cmd"
    return subprocess.run(executable, cwd=ROOT, env=environment, check=False).returncode


def manage(action: str, environment: dict[str, str]) -> int:
    return run(
        [sys.executable, str(ROOT / "scripts" / "manage.py"), action, "--profile", "test"],
        environment,
    )


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        raise RuntimeError("Playwright E2E 只允许 test profile")
    database_url = os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    if not target.database.lower().endswith("_test"):
        raise RuntimeError("Playwright E2E 只允许连接名称以 _test 结尾的数据库")

    environment = os.environ.copy()
    base_url = "http://localhost:3001"
    environment.update({
        "CRM_E2E_RUN_ID": uuid4().hex[:12],
        "CRM_E2E_PASSWORD": secrets.token_urlsafe(18),
        "CRM_E2E_BASE_URL": base_url,
        "CRM_TEST_NEXTAUTH_URL": base_url,
        "AUTH_URL": base_url,
        "NEXTAUTH_URL": base_url,
        "CRM_UPLOAD_DIR": str(ROOT / "storage" / "test"),
        "PLAYWRIGHT_HTML_OPEN": "never",
    })

    manage("stop", environment)
    try:
        if manage("start", environment) != 0:
            return 1
        test_code = run(
            ["npx", "playwright", "test", "--config", "playwright.config.ts"],
            environment,
        )
        report_code = run([sys.executable, str(ROOT / "scripts" / "e2e" / "report.py")], environment)
        return test_code if test_code != 0 else report_code
    finally:
        stop_code = manage("stop", environment)
        if stop_code != 0:
            print(f"E2E 结束后停止 test 服务失败，退出码 {stop_code}", file=sys.stderr)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Playwright E2E 运行失败: {error}", file=sys.stderr)
        raise SystemExit(1)
