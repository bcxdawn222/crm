from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from deploy.production.remote import RemoteClient, RemoteSettings
from deploy.production.workflow import audit, deploy, rollback, stage


def main() -> int:
    parser = argparse.ArgumentParser(description="CRM 线上审计、候选验收、部署和回滚")
    parser.add_argument("action", choices=("audit", "stage", "deploy", "rollback"))
    parser.add_argument("--artifact", type=Path)
    args = parser.parse_args()
    if args.action in {"stage", "deploy"} and args.artifact is None:
        parser.error(f"{args.action} 必须提供 --artifact")
    try:
        with RemoteClient(RemoteSettings.from_environment()) as client:
            if args.action == "audit":
                audit(client)
            elif args.action == "stage":
                stage(client, args.artifact)
            elif args.action == "deploy":
                deploy(client, args.artifact)
            else:
                rollback(client)
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(f"线上发布操作失败: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
