from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Sequence

sys.dont_write_bytecode = True

from runtime_manager import (
    is_port_open,
    start_database,
    start_server,
    stop_server,
    stop_database_direct,
)
from profile_config import ProfileConfig, get_profile_config


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"


@dataclass(frozen=True)
class CommandResult:
    name: str
    return_code: int


def configure_logger(action: str, profile: ProfileConfig) -> logging.Logger:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    profile.log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = profile.log_dir / f"manage-{action}-{timestamp}.log"
    logger = logging.getLogger("crm-manage")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.info("日志文件: %s", log_path)
    return logger


def run_command(name: str, command: Sequence[str], logger: logging.Logger) -> CommandResult:
    executable_command = list(command)
    if os.name == "nt" and executable_command[0] in {"npm", "npx"}:
        executable_command[0] = f"{executable_command[0]}.cmd"
    logger.info("执行 %s: %s", name, " ".join(executable_command))
    child_env = os.environ.copy()
    child_env.setdefault("PYTHONIOENCODING", "utf-8")
    process = subprocess.Popen(
        executable_command,
        cwd=ROOT,
        env=child_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    for line in process.stdout:
        logger.info("[%s] %s", name, line.rstrip())
    return_code = process.wait()
    logger.info("%s 退出码: %s", name, return_code)
    return CommandResult(name=name, return_code=return_code)


def run_sequence(commands: Sequence[tuple[str, Sequence[str]]], logger: logging.Logger) -> int:
    for name, command in commands:
        result = run_command(name, command, logger)
        if result.return_code != 0:
            return result.return_code
    return 0


def run_route_check(logger: logging.Logger) -> int:
    checks = (
        (ROOT / "src/app/api/customers/renewal-reminders/route.ts", True),
        (ROOT / "src/app/api/public-pool/claim/route.ts", True),
        (ROOT / "src/app/api/tasks/assignees/route.ts", True),
    )
    for path, should_exist in checks:
        if path.exists() != should_exist:
            logger.error("路由文件状态不符合预期: %s", path)
            return 1

    cooperating_route = (ROOT / "src/app/api/customers/cooperating/route.ts").read_text(
        encoding="utf-8"
    )
    payments_page = (ROOT / "src/app/(dashboard)/finance/payments/page.tsx").read_text(
        encoding="utf-8"
    )
    orders_page = (ROOT / "src/app/(dashboard)/finance/orders/page.tsx").read_text(
        encoding="utf-8"
    )
    order_form = (ROOT / "src/app/(dashboard)/finance/orders/order-form-modal.tsx").read_text(
        encoding="utf-8"
    )
    tasks_page = (ROOT / "src/app/(dashboard)/tasks/page.tsx").read_text(
        encoding="utf-8"
    )
    task_form = (ROOT / "src/app/(dashboard)/tasks/task-form-modal.tsx").read_text(
        encoding="utf-8"
    )
    order_api = (ROOT / "src/app/api/finance/orders/route.ts").read_text(encoding="utf-8")
    task_api = (ROOT / "src/app/api/tasks/route.ts").read_text(encoding="utf-8")
    assignee_api = (ROOT / "src/app/api/tasks/assignees/route.ts").read_text(encoding="utf-8")
    forbidden_fragments = (
        ("GET_REMINDERS", cooperating_route),
        ("/api/finance/payments/${id}", payments_page),
        ("PROCESSING", orders_page),
        ("DONE", tasks_page),
    )
    for fragment, content in forbidden_fragments:
        if fragment in content:
            logger.error("仍存在失效契约: %s", fragment)
            return 1

    required_fragments = (
        ("订单客户远程查询", "/api/customers?", order_form),
        ("订单客户选项", "customerOptions", order_form),
        ("任务负责人远程查询", "/api/tasks/assignees?", task_form),
        ("任务负责人选项", "assigneeOptions", task_form),
        ("订单客户范围校验", "buildDataFilter", order_api),
        ("任务负责人范围校验", "findTaskAssigneeWithinScope", task_api),
        ("任务负责人接口分页", "parsePagination", assignee_api),
    )
    for label, fragment, content in required_fragments:
        if fragment not in content:
            logger.error("缺少本轮流程契约: %s (%s)", label, fragment)
            return 1

    logger.info("路由契约静态检查通过")
    return 0


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
            "build",
            "typecheck",
            "routes",
            "check",
            "test",
            "smoke",
            "dbstart",
            "dbstatus",
            "dbstop",
            "audit",
            "audit-data",
            "start",
            "stop",
            "status",
            "instance-status",
            "button-audit",
            "data-reachability",
            "e2e",
            "perf",
            "release",
            "promote",
            "rollback",
        ),
    )
    parser.add_argument("--profile", choices=("stable", "test"), default="stable")
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="audit-data 仅检查迁移目录和备份，不连接数据库",
    )
    args = parser.parse_args()
    try:
        profile = get_profile_config(args.profile)
    except ValueError as error:
        print(f"profile 配置错误: {error}", file=sys.stderr)
        return 2
    logger = configure_logger(args.action, profile)
    logger.info(
        "当前 profile=%s，数据库=%s:%s，应用端口=%s",
        profile.name,
        profile.database_host,
        profile.database_port,
        profile.app_port,
    )

    if args.action == "start":
        return start_server(logger, profile)
    if args.action == "stop":
        return stop_server(logger, profile)
    if args.action in {"status", "instance-status"}:
        pid_state = "不存在"
        if profile.pid_file.exists():
            pid_state = profile.pid_file.read_text(encoding="ascii", errors="replace").strip()
        port_state = "已监听" if is_port_open(profile.app_host, profile.app_port) else "未监听"
        logger.info(
            "profile=%s PID=%s 端口=%s 锁=%s",
            profile.name,
            pid_state,
            port_state,
            profile.lock_file.exists(),
        )
        return 0
    if args.action == "dbstart":
        return start_database(logger, profile)
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
    if args.action == "button-audit":
        command = [sys.executable, str(ROOT / "scripts" / "button_audit.py")]
        return run_sequence((("button-audit", command),), logger)
    if args.action == "data-reachability":
        command = [sys.executable, str(ROOT / "scripts" / "data_reachability.py")]
        return run_sequence((("data-reachability", command),), logger)
    if args.action in {"e2e", "perf", "release", "promote", "rollback"}:
        logger.error("动作已登记但尚未实现: %s", args.action)
        return 3

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
