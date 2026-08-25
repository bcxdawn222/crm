from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Sequence

sys.dont_write_bytecode = True
from cli.command_runner import configure_logger, run_sequence as execute_sequence
from runtime.manager import (
    is_port_open,
    start_database,
    start_server,
    stop_server,
    stop_database_direct,
)
from runtime.instance_state import inspect_instance
from runtime.release_actions import run_release_action
from runtime.profile_config import ProfileConfig, get_profile_config
from runtime.route_contracts import run_route_check
ROOT = Path(__file__).resolve().parents[1]
TEST_FLOW_SCRIPTS = {
    "data-flow": "data_flow_test.py",
    "content-flow": "content_flow_test.py",
    "user-flow": "user_flow_test.py",
    "role-flow": "role_flow_test.py",
    "settings-flow": "settings_flow_test.py",
    "public-pool-flow": "public_pool_flow_test.py",
    "scope-flow": "scope_flow_test.py",
    "network-session-flow": "network_session_flow_test.py",
    "permission-flow": "permission_flow_test.py",
    "server-governance": "server_governance.py",
    "server-runtime-drill": "server_runtime_drill.py",
    "perf": "../performance/frontend_budget.py",
    "perf-runtime": "../performance/frontend_runtime.py",
    "api-perf": "../performance/api_database.py",
    "stability": "../performance/stability.py",
    "security-flow": "security_flow_test.py",
    "final-audit": "final_repository_audit.py",
    "e2e": "../e2e/run.py",
}

def run_sequence(commands: Sequence[tuple[str, Sequence[str]]], logger: logging.Logger) -> int:
    return execute_sequence(commands, logger, ROOT)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="CRM 项目运行与检查入口")
    parser.add_argument(
        "action",
        choices=(
            "generate",
            "migrate",
            "seed",
            "build",
            "typecheck",
            "routes",
            "check",
            "test",
            "smoke",
            "dbstart",
            "dbinit-test",
            "dbstatus",
            "dbstop",
            "audit",
            "audit-data",
            "security",
            "start",
            "stop",
            "status",
            "instance-status",
            "button-audit",
            "data-reachability",
            "permission-matrix",
            *TEST_FLOW_SCRIPTS,
            "instance-test",
            "release-test",
            "runtime-test",
            "release",
            "promote",
            "rollback",
        ),
    )
    parser.add_argument("--profile", choices=("stable", "test"), default="stable")
    parser.add_argument("--mode", choices=("development", "production"),
                        default="development", help="start 使用的服务模式")
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="audit-data 仅检查迁移目录和备份，不连接数据库",
    )
    parser.add_argument("--artifact", help="promote/rollback 使用的发布压缩包路径")
    args = parser.parse_args()
    try:
        profile = get_profile_config(args.profile)
    except ValueError as error:
        print(f"profile 配置错误: {error}", file=sys.stderr)
        return 2
    os.environ["CRM_PROFILE"] = profile.name
    os.environ["DATABASE_URL"] = profile.database_url
    os.environ["AUTH_SECRET"] = profile.auth_secret
    os.environ["NEXTAUTH_SECRET"] = profile.auth_secret
    os.environ["AUTH_URL"] = profile.auth_url
    os.environ["NEXTAUTH_URL"] = profile.auth_url
    try:
        logger = configure_logger(args.action, profile)
    except OSError as error:
        print(f"日志初始化失败: {error}", file=sys.stderr)
        return 2
    logger.info(
        "当前 profile=%s，数据库=%s:%s，应用端口=%s",
        profile.name,
        profile.database_host,
        profile.database_port,
        profile.app_port,
    )

    if args.action == "start":
        return start_server(logger, profile, mode=args.mode)
    if args.action == "stop":
        return stop_server(logger, profile)
    if args.action in {"status", "instance-status"}:
        inspection = inspect_instance(profile)
        logger.info(
            "profile=%s 状态=%s PID=%s 端口=%s 端口进程=%s 锁=%s 详情=%s",
            profile.name,
            inspection.kind.value,
            inspection.pid if inspection.pid is not None else "不存在",
            "已监听" if is_port_open(profile.app_host, profile.app_port) else "未监听",
            list(inspection.port_pids),
            profile.lock_file.exists(),
            inspection.detail,
        )
        return 0
    if args.action == "dbstart":
        return start_database(logger, profile)
    if args.action == "dbinit-test":
        if profile.name != "test":
            logger.error("dbinit-test 只允许 --profile test")
            return 2
        command = [sys.executable, str(ROOT / "scripts/quality/setup_test_database.py")]
        return run_sequence((("dbinit-test", command),), logger)
    if args.action == "dbstatus":
        if is_port_open(profile.database_host, profile.database_port):
            logger.info("数据库端口已就绪: %s:%s", profile.database_host, profile.database_port)
            return 0
        logger.error("数据库端口未监听: %s:%s", profile.database_host, profile.database_port)
        return 1
    if args.action == "dbstop":
        return stop_database_direct(logger)
    if args.action == "routes":
        return run_route_check(logger)
    if args.action == "smoke":
        return run_sequence(
            (("smoke", (sys.executable, str(ROOT / "scripts/smoke-http.py"))),), logger
        )
    if args.action == "generate":
        return run_sequence((("prisma-generate", ("npx", "prisma", "generate")),), logger)
    if args.action == "migrate":
        return run_sequence(
            (("prisma-migrate-deploy", ("npx", "prisma", "migrate", "deploy")),),
            logger,
        )
    if args.action == "seed":
        return run_sequence(
            (("prisma-seed", ("npx", "ts-node", "prisma/seed.ts")),),
            logger,
        )
    if args.action == "build":
        return run_sequence(
            (
                ("prisma-generate", ("npx", "prisma", "generate")),
                ("build", ("npm", "run", "build")),
            ),
            logger,
        )
    if args.action == "typecheck":
        return run_sequence(
            (
                ("prisma-generate", ("npx", "prisma", "generate")),
                ("typecheck", ("npx", "tsc", "--noEmit")),
            ),
            logger,
        )
    if args.action == "audit":
        return run_sequence(
            (("audit", ("npm", "audit", "--registry=https://registry.npmjs.org")),), logger
        )
    if args.action == "audit-data":
        command = [sys.executable, str(ROOT / "scripts" / "audit_data.py")]
        if args.skip_db:
            command.append("--skip-db")
        return run_sequence(
            (("audit-data", command),), logger
        )
    if args.action == "security":
        if profile.name != "test":
            logger.error("security 只允许 --profile test")
            return 2
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "security_audit.py")]
        return run_sequence((("security", command),), logger)
    if args.action == "button-audit":
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "button_audit.py")]
        return run_sequence((("button-audit", command),), logger)
    if args.action == "data-reachability":
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "data_reachability.py")]
        return run_sequence((("data-reachability", command),), logger)
    if args.action == "permission-matrix":
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "permission_matrix.py")]
        return run_sequence((("permission-matrix", command),), logger)
    if args.action in TEST_FLOW_SCRIPTS:
        if profile.name != "test":
            logger.error("%s 只允许 --profile test", args.action)
            return 2
        command = [
            sys.executable,
            str((ROOT / "scripts" / "quality" / TEST_FLOW_SCRIPTS[args.action]).resolve()),
        ]
        return run_sequence(((args.action, command),), logger)
    if args.action == "runtime-test":
        return run_sequence(
            (
                ("runtime-test", (sys.executable, str(ROOT / "scripts" / "quality" / "runtime_checks.py"))),
                ("instance-test", (sys.executable, str(ROOT / "scripts" / "quality" / "instance_flow_test.py"))),
                ("smoke-script-test", (sys.executable, str(ROOT / "scripts" / "quality" / "smoke_script_test.py"))),
            ),
            logger,
        )
    if args.action == "instance-test":
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "instance_flow_test.py")]
        return run_sequence((("instance-test", command),), logger)
    if args.action == "release-test":
        command = [sys.executable, str(ROOT / "scripts" / "quality" / "release_flow_test.py")]
        return run_sequence((("release-test", command),), logger)
    if args.action in {"release", "promote", "rollback"}:
        return run_release_action(args.action, profile, args.artifact, logger, run_sequence, ROOT)
    route_result = run_route_check(logger)
    if route_result != 0:
        return route_result
    return run_sequence(
        (
            ("prisma-generate", ("npx", "prisma", "generate")),
            ("typecheck", ("npx", "tsc", "--noEmit")),
            ("build", ("npm", "run", "build")),
        ),
        logger,
    )


if __name__ == "__main__":
    raise SystemExit(main())
