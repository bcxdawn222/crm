from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
CHECKS = ("scope_flow_test.py", "role_flow_test.py")


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("拒绝执行：permission-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2
    for script_name in CHECKS:
        script = ROOT / "scripts" / "quality" / script_name
        result = subprocess.run((sys.executable, str(script)), cwd=ROOT, check=False)
        if result.returncode != 0:
            return result.returncode
    print("权限范围、角色刷新与用户停用验收通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
