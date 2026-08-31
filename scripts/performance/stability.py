from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Mapping


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from performance.stability_metrics import (
    ResourceSample,
    collect_sample,
    load_k6_result,
    sample_until_stopped,
    write_reports,
)
from quality.crm_http import build_opener, login, request, require
from runtime.instance_state import InstanceKind, inspect_instance
from runtime.mysql_client import DatabaseTarget, parse_database_url, run_mysql
from runtime.process_identity import process_tree_ids
from runtime.profile_config import get_profile_config


@dataclass(frozen=True)
class StabilityConfig:
    base_url: str
    username: str
    password: str
    duration: str
    duration_seconds: int
    read_vus: int
    write_iterations: int
    sample_interval_seconds: int


def positive_int(name: str, default: int) -> int:
    value = os.environ.get(name, str(default)).strip()
    if not value.isdigit() or int(value) <= 0:
        raise RuntimeError(f"{name} 必须是正整数")
    return int(value)


def duration_seconds(value: str) -> int:
    match = re.fullmatch(r"(\d+)(s|m|h)", value.strip())
    if not match:
        raise RuntimeError("CRM_STABILITY_DURATION 必须使用 30s、3m 或 1h 格式")
    amount = int(match.group(1))
    multiplier = {"s": 1, "m": 60, "h": 3600}[match.group(2)]
    seconds = amount * multiplier
    if seconds < 60:
        raise RuntimeError("稳定性测试持续时间不能少于 60 秒")
    return seconds


def load_config() -> StabilityConfig:
    if os.environ.get("CRM_PROFILE") != "test":
        raise RuntimeError("稳定性与压力测试只允许 test profile")
    username = os.environ.get("CRM_STABILITY_USERNAME", "").strip()
    password = os.environ.get("CRM_STABILITY_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("缺少 CRM_STABILITY_USERNAME 或 CRM_STABILITY_PASSWORD")
    duration = os.environ.get("CRM_STABILITY_DURATION", "3m").strip()
    return StabilityConfig(
        base_url=os.environ.get("CRM_STABILITY_BASE_URL", "http://127.0.0.1:3001").rstrip("/"),
        username=username,
        password=password,
        duration=duration,
        duration_seconds=duration_seconds(duration),
        read_vus=positive_int("CRM_STABILITY_READ_VUS", 8),
        write_iterations=positive_int("CRM_STABILITY_WRITE_ITERATIONS", 8),
        sample_interval_seconds=positive_int("CRM_STABILITY_SAMPLE_INTERVAL_SECONDS", 10),
    )


def run_manage(arguments: list[str], environment: Mapping[str, str]) -> None:
    command = [sys.executable, str(ROOT / "scripts" / "manage.py"), *arguments, "--profile", "test"]
    result = subprocess.run(command, cwd=ROOT, env=dict(environment), check=False)
    if result.returncode != 0:
        raise RuntimeError(f"manage.py {' '.join(arguments)} 失败，退出码 {result.returncode}")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_connections(target: DatabaseTarget) -> int:
    output = run_mysql(target, "SHOW STATUS LIKE 'Threads_connected'")
    columns = output.split("\t")
    if len(columns) != 2 or not columns[1].isdigit():
        raise RuntimeError("数据库连接数输出格式错误")
    return int(columns[1])


def cleanup_marker(target: DatabaseTarget, marker: str) -> None:
    pattern = sql_quote(f"{marker}%")
    run_mysql(
        target,
        "START TRANSACTION; "
        + "DELETE FROM AuditEvent WHERE requestId LIKE " + pattern
        + " OR (entityType='Customer' AND entityId IN "
        + f"(SELECT id FROM Customer WHERE name LIKE {pattern})); "
        + f"DELETE FROM Customer WHERE name LIKE {pattern}; COMMIT;",
    )
    customer_count = run_mysql(target, f"SELECT COUNT(*) FROM Customer WHERE name LIKE {pattern}")
    audit_count = run_mysql(target, f"SELECT COUNT(*) FROM AuditEvent WHERE requestId LIKE {pattern}")
    require(customer_count == "0" and audit_count == "0", "稳定性测试夹具清理失败")


def warmup(config: StabilityConfig) -> None:
    opener = build_opener()
    login(opener, config.base_url, config.username, config.password)
    for path in (
        "/api/health",
        "/api/customers?page=1&pageSize=20",
        "/api/statistics/sales-overview",
        "/api/statistics/funnel",
        "/api/reminders",
    ):
        response = request(opener, config.base_url, path)
        require(response.status == 200, f"预热接口失败: {path}, HTTP {response.status}")


def run_k6(
    config: StabilityConfig,
    environment: dict[str, str],
    target: DatabaseTarget,
    marker: str,
) -> tuple[Path, list[ResourceSample]]:
    k6 = shutil.which("k6")
    if not k6:
        raise RuntimeError("未找到 k6，请先安装 Grafana k6")
    summary_path = ROOT / "logs" / "test" / f"k6-stability-{marker}.json"
    k6_env = environment.copy()
    k6_env.update({
        "CRM_STABILITY_BASE_URL": config.base_url,
        "CRM_STABILITY_USERNAME": config.username,
        "CRM_STABILITY_PASSWORD": config.password,
        "CRM_STABILITY_MARKER": marker,
        "CRM_STABILITY_SUMMARY_PATH": str(summary_path),
        "CRM_STABILITY_DURATION": config.duration,
        "CRM_STABILITY_READ_VUS": str(config.read_vus),
        "CRM_STABILITY_WRITE_ITERATIONS": str(config.write_iterations),
    })
    profile = get_profile_config("test")
    inspection = inspect_instance(profile)
    require(inspection.kind == InstanceKind.RUNNING and inspection.pid is not None, "test 服务未运行")
    pids = process_tree_ids(inspection.pid)
    samples: list[ResourceSample] = []
    monitor_errors: list[Exception] = []
    stop = Event()
    server_log = ROOT / "logs" / "test" / "server.log"
    sample_factory = lambda: collect_sample(pids, database_connections(target), server_log)
    samples.append(sample_factory())
    monitor = Thread(
        target=sample_until_stopped,
        args=(stop, config.sample_interval_seconds, sample_factory, samples, monitor_errors),
        daemon=True,
    )
    monitor.start()
    try:
        result = subprocess.run(
            [k6, "run", "--no-color", "--no-usage-report", str(ROOT / "k6" / "scripts" / "crm-stability.js")],
            cwd=ROOT,
            env=k6_env,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"k6 稳定性场景失败，退出码 {result.returncode}")
    finally:
        stop.set()
        monitor.join(timeout=config.sample_interval_seconds + 5)
    if monitor_errors:
        raise RuntimeError(f"资源采样失败: {monitor_errors[0]}")
    require(summary_path.is_file(), "k6 未生成 summary 文件")
    require(bool(samples), "没有采集到服务资源数据")
    return summary_path, samples


def restart_drill(config: StabilityConfig, environment: dict[str, str]) -> float:
    opener = build_opener()
    login(opener, config.base_url, config.username, config.password)
    require(request(opener, config.base_url, "/api/health").status == 200, "重启前健康检查失败")
    run_manage(["stop"], environment)
    try:
        urllib.request.urlopen(f"{config.base_url}/api/health", timeout=2)
    except (urllib.error.URLError, TimeoutError):
        pass
    else:
        raise RuntimeError("服务停止期间健康接口仍返回成功")
    started = time.monotonic()
    run_manage(["start", "--mode", "production"], environment)
    recovery_seconds = time.monotonic() - started
    require(recovery_seconds <= 30, f"服务重启恢复超过 30 秒: {recovery_seconds:.2f}")
    new_opener = build_opener()
    login(new_opener, config.base_url, config.username, config.password)
    response = request(new_opener, config.base_url, "/api/customers?page=1&pageSize=1")
    require(response.status == 200, f"重启后业务接口失败，HTTP {response.status}")
    return round(recovery_seconds, 2)


def verify_session_expiry(config: StabilityConfig, environment: dict[str, str]) -> None:
    run_manage(["stop"], environment)
    expiry_env = environment.copy()
    expiry_env["CRM_SESSION_MAX_AGE_SECONDS"] = "60"
    expiry_env["CRM_SESSION_EXPIRY_WAIT_SECONDS"] = "60"
    expiry_env["CRM_NETWORK_TEST_MARKER"] = ""
    expiry_env["CRM_SMOKE_USERNAME"] = config.username
    expiry_env["CRM_SMOKE_PASSWORD"] = config.password
    run_manage(["start", "--mode", "production"], expiry_env)
    run_manage(["network-session-flow"], expiry_env)


def assert_budgets(result, samples: list[ResourceSample]) -> None:
    require(result.request_count > 0 and result.iteration_count > 0, "k6 没有产生有效请求")
    require(result.p95_ms < 1500 and result.p99_ms < 3000, "HTTP 延迟预算未通过")
    require(result.failure_rate < 0.01 and result.check_rate > 0.99, "HTTP 成功率预算未通过")
    require(result.write_p95_ms < 2000 and result.dropped_iterations == 0, "受控写入预算未通过")
    rss = [sample.rss_mb for sample in samples]
    handles = [sample.handles for sample in samples]
    connections = [sample.database_connections for sample in samples]
    load_cpu = [sample.load_generator_cpu_percent for sample in samples]
    load_memory = [sample.load_generator_memory_percent for sample in samples]
    require(max(rss) - min(rss) < 512, "CRM 进程内存增长超过 512 MB")
    require(max(handles) - min(handles) < 500, "CRM 进程句柄增长超过 500")
    require(max(connections) <= 50, "数据库连接峰值超过 50")
    require(max(load_cpu) < 95 and max(load_memory) < 95, "负载机资源超过 95%，本次压测结果无效")


def main() -> int:
    config = load_config()
    environment = os.environ.copy()
    target = parse_database_url(environment.get("DATABASE_URL", ""))
    require(target.database.lower().endswith("_test"), "稳定性测试只允许 _test 数据库")
    marker = "K6-STABILITY-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    summary_path: Path | None = None
    samples: list[ResourceSample] = []
    try:
        run_manage(["stop"], environment)
        run_manage(["build"], environment)
        run_manage(["start", "--mode", "production"], environment)
        warmup(config)
        summary_path, samples = run_k6(config, environment, target, marker)
        result = load_k6_result(summary_path)
        assert_budgets(result, samples)
        cleanup_marker(target, marker)
        restart_seconds = restart_drill(config, environment)
        verify_session_expiry(config, environment)
        report_path, document_path = write_reports(
            result, samples, restart_seconds, True, summary_path
        )
        print(f"稳定性与压力测试通过，报告: {report_path}")
        print(f"汇总文档: {document_path}")
        return 0
    finally:
        try:
            cleanup_marker(target, marker)
        finally:
            run_manage(["stop"], environment)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"稳定性与压力测试失败: {error}", file=sys.stderr)
        raise SystemExit(1)
