from __future__ import annotations

import os
import re
import sys
from pathlib import Path


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from runtime.mysql_client import parse_database_url, run_mysql
from runtime.profile_config import get_profile_config


SAFE_DATABASE_NAME = re.compile(r"^[A-Za-z0-9_]+_test$")


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("拒绝执行：该脚本只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    profile = get_profile_config("test")
    target = parse_database_url(profile.database_url)
    if not SAFE_DATABASE_NAME.fullmatch(target.database):
        print("拒绝执行：测试数据库名称必须以 _test 结尾", file=sys.stderr)
        return 2

    run_mysql(
        target,
        f"CREATE DATABASE IF NOT EXISTS `{target.database}` "
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        include_database=False,
    )
    print(f"测试数据库已就绪: {target.host}:{target.port}/{target.database}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
