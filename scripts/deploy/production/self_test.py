from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
WORKER = Path(__file__).with_name("remote_release.sh")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    source = WORKER.read_text(encoding="utf-8")
    nginx = (ROOT / "scripts/deploy/nginx-crm-system.conf").read_text(encoding="utf-8")
    service = (ROOT / "scripts/deploy/crm@.service").read_text(encoding="utf-8")
    require("sha256sum -c" in source, "候选包缺少 SHA256 门禁")
    require("prisma migrate status" in source, "候选包缺少迁移状态门禁")
    require("crm-db-backup.service" in source and "gzip -t" in source, "部署前缺少可读备份检查")
    require("127.0.0.1 --port 3000" in source, "stable 没有限制为本机监听")
    require("StandardOutput=append:" in source and "StandardError=append:" in source, "systemd 没有写入共享应用日志")
    require("ExecStartPost=/usr/bin/curl" in source, "systemd 缺少启动后健康检查")
    require("--retry-connrefused" in source, "systemd 启动健康检查不会重试端口尚未监听")
    require("nginx -t" in source and "nginx -s reopen" in source, "Nginx 缺少校验或日志 reopen")
    require("rollback_after_failure" in source, "切换失败没有自动恢复")
    require('candidate_pgid=$(ps -o pgid=' in source, "候选服务没有从记录 PID 解析实际进程组")
    require('kill -- "-$candidate_pgid"' in source, "候选服务没有按实际进程组清理 Next.js 子进程")
    require("crm_connection_upgrade" in nginx, "Nginx 模板缺少动态 Connection map")
    require("127.0.0.1" in service and "Restart=always" in service, "systemd 模板缺少本机监听或重启策略")
    require(not (ROOT / "scripts/deploy/ecosystem.config.mjs").exists(), "仍保留会造成双管理的 PM2 模板")
    print("线上发布治理脚本契约检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
