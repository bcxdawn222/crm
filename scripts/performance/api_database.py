from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Mapping


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from quality.crm_http import build_opener, json_body, login, request, require
from runtime.mysql_client import parse_database_url, run_mysql
from performance.api_database_fixtures import cleanup_performance_fixture, create_performance_fixture


BASE_URL = os.environ.get("CRM_PERF_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
SERVER_LOG = ROOT / "logs" / "test" / "server.log"
SAMPLE_COUNT = 3

RowMode = Literal["list", "daily", "reminders", "trend", "funnel", "none"]


@dataclass(frozen=True)
class EndpointCase:
    name: str
    path: str
    row_mode: RowMode


@dataclass(frozen=True)
class EndpointResult:
    name: str
    path: str
    average_ms: float
    p95_ms: float
    max_queries: int
    rows: int
    error_rate: float


@dataclass(frozen=True)
class ExplainResult:
    name: str
    access_type: str
    key: str
    estimated_rows: int
    extra: str


CASES = (
    EndpointCase("客户列表", "/api/customers?page=1&pageSize=20", "list"),
    EndpointCase("用户列表", "/api/users?includeInactive=true&page=1&pageSize=20", "list"),
    EndpointCase("每日客资", "/api/daily-leads?page=1&pageSize=10", "daily"),
    EndpointCase("提醒中心", "/api/reminders", "reminders"),
    EndpointCase("续签提醒", "/api/customers/renewal-reminders?days=30", "daily"),
    EndpointCase("公海列表", "/api/public-pool?page=1&pageSize=20", "list"),
    EndpointCase("公海统计", "/api/public-pool/statistics", "trend"),
    EndpointCase("销售总览", "/api/statistics/sales-overview", "none"),
    EndpointCase("销售趋势", "/api/statistics/trend?period=30d", "trend"),
    EndpointCase("销售漏斗", "/api/statistics/funnel", "funnel"),
    EndpointCase("财务汇总", "/api/finance/reports/summary", "none"),
    EndpointCase("订单列表", "/api/finance/orders?page=1&pageSize=20", "list"),
    EndpointCase("回款列表", "/api/finance/payments?page=1&pageSize=20", "list"),
    EndpointCase("文件列表", "/api/files?page=1&pageSize=20", "list"),
    EndpointCase("消息列表", "/api/messages?page=1&pageSize=20", "list"),
)

EXPLAIN_QUERIES = (
    ("客户列表", "EXPLAIN SELECT id FROM Customer WHERE isPublic=FALSE ORDER BY createdAt DESC LIMIT 20"),
    ("续签提醒", "EXPLAIN SELECT id FROM Customer WHERE contractEndDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY) ORDER BY contractEndDate LIMIT 100"),
    ("订单列表", "EXPLAIN SELECT id FROM `Order` ORDER BY createdAt DESC LIMIT 20"),
    ("回款列表", "EXPLAIN SELECT id FROM Payment ORDER BY paymentDate DESC LIMIT 20"),
    ("消息列表", "EXPLAIN SELECT id FROM Message WHERE receiverId='' ORDER BY createdAt DESC LIMIT 20"),
    ("公海认领审计", "EXPLAIN SELECT id FROM AuditEvent WHERE action='CLAIM' AND createdAt>=DATE_SUB(NOW(), INTERVAL 30 DAY)"),
)


def load_credentials() -> tuple[str, str]:
    username = os.environ.get("CRM_PERF_USERNAME") or os.environ.get("CRM_SMOKE_USERNAME")
    password = os.environ.get("CRM_PERF_PASSWORD") or os.environ.get("CRM_SMOKE_PASSWORD")
    if not username or not password:
        raise RuntimeError("缺少 CRM_PERF_USERNAME/CRM_PERF_PASSWORD 或 CRM_SMOKE_USERNAME/CRM_SMOKE_PASSWORD")
    return username, password


def run_manage(action: str, env: Mapping[str, str]) -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "manage.py"), action, "--profile", "test"],
        cwd=ROOT,
        env=dict(env),
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"manage.py {action} 失败，退出码 {result.returncode}")


def log_offset() -> int:
    return SERVER_LOG.stat().st_size if SERVER_LOG.exists() else 0


def query_count(offset: int) -> int:
    if not SERVER_LOG.exists():
        return 0
    with SERVER_LOG.open("rb") as handle:
        handle.seek(offset)
        return handle.read().count(b"prisma:query")


def row_count(payload: Mapping[str, object], mode: RowMode) -> int:
    data = payload.get("data")
    if mode == "list":
        if isinstance(data, list):
            return len(data)
        if isinstance(data, Mapping):
            rows = data.get("list")
            return len(rows) if isinstance(rows, list) else 0
    if mode == "daily":
        return len(data) if isinstance(data, list) else 0
    if mode == "reminders" and isinstance(data, Mapping):
        return sum(len(data.get(key, [])) for key in (
            "overdueFollowUp", "expiringContracts", "upcomingVisits", "plannedFollowUps"
        ))
    if mode == "trend" and isinstance(data, Mapping):
        rows = data.get("dataPoints") or data.get("trend")
        return len(rows) if isinstance(rows, list) else 0
    if mode == "funnel" and isinstance(data, Mapping):
        rows = data.get("stages")
        return len(rows) if isinstance(rows, list) else 0
    return 1 if isinstance(data, Mapping) else 0


def measure_case(opener, case: EndpointCase) -> EndpointResult:
    warmup = request(opener, BASE_URL, case.path)
    require(warmup.status == 200, f"{case.name} 预热失败，HTTP {warmup.status}")
    durations: list[float] = []
    queries: list[int] = []
    errors = 0
    rows = 0
    for _ in range(SAMPLE_COUNT):
        offset = log_offset()
        started = time.perf_counter()
        result = request(opener, BASE_URL, case.path)
        durations.append((time.perf_counter() - started) * 1000)
        time.sleep(0.15)
        queries.append(query_count(offset))
        if result.status != 200:
            errors += 1
            continue
        payload = json_body(result)
        rows = row_count(payload, case.row_mode)
    return EndpointResult(
        name=case.name,
        path=case.path,
        average_ms=round(statistics.mean(durations), 1),
        p95_ms=round(statistics.quantiles(durations, n=100, method="inclusive")[94], 1),
        max_queries=max(queries),
        rows=rows,
        error_rate=round(errors / SAMPLE_COUNT, 3),
    )


def explain_plans(database_url: str) -> list[ExplainResult]:
    target = parse_database_url(database_url)
    plans: list[ExplainResult] = []
    for name, sql in EXPLAIN_QUERIES:
        output = run_mysql(target, sql)
        columns = output.splitlines()[0].split("\t") if output else []
        if len(columns) < 12:
            raise RuntimeError(f"{name} 的 EXPLAIN 输出不完整")
        plans.append(ExplainResult(
            name=name,
            access_type=columns[4],
            key="" if columns[6] == "NULL" else columns[6],
            estimated_rows=int(float(columns[9])),
            extra=columns[11],
        ))
    return plans


def write_reports(results: list[EndpointResult], plans: list[ExplainResult]) -> Path:
    generated_at = datetime.now(timezone.utc).isoformat()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = ROOT / "logs" / "test" / f"api-database-performance-{timestamp}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": generated_at,
        "profile": "test",
        "sampleCount": SAMPLE_COUNT,
        "endpoints": [asdict(result) for result in results],
        "explainPlans": [asdict(plan) for plan in plans],
    }
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    rows = "\n".join(
        f"| {item.name} | {item.average_ms:.1f} | {item.p95_ms:.1f} | {item.max_queries} | {item.rows} | {item.error_rate:.1%} |"
        for item in results
    )
    plan_rows = "\n".join(
        f"| {item.name} | {item.access_type} | {item.key or '-'} | {item.estimated_rows} | {item.extra or '-'} |"
        for item in plans
    )
    document = f"""# API 与数据库性能\n\n> 生成时间：{generated_at}；环境：test；每个接口预热后采样 {SAMPLE_COUNT} 次。\n\n## 接口结果\n\n| 接口 | 平均耗时(ms) | p95(ms) | 最大查询数 | 返回行数 | 错误率 |\n| --- | ---: | ---: | ---: | ---: | ---: |\n{rows}\n\n## 执行计划\n\n| 查询 | access type | key | 估算行数 | Extra |\n| --- | --- | --- | ---: | --- |\n{plan_rows}\n\n## 预算\n\n- 单接口 p95 不超过 2000 ms。\n- 单请求 Prisma 查询数不超过 20。\n- 列表和提醒单次返回不超过 100 行。\n- 错误率必须为 0。\n- 当前 test 数据量较小，执行计划中的全表扫描仅在估算行数超过 1000 时判定为失败；没有慢查询证据时不新增索引。\n\n原始报告：`{report_path}`\n"""
    document_path = ROOT / "docs" / "API与数据库性能.md"
    with document_path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(document)
    return report_path


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        raise RuntimeError("API 与数据库性能检查只允许 test profile")
    database_url = os.environ.get("DATABASE_URL", "")
    require(bool(database_url), "缺少 test DATABASE_URL")
    environment = os.environ.copy()
    environment["CRM_PRISMA_QUERY_LOG"] = "1"
    username, password = load_credentials()
    run_manage("stop", environment)
    fixture = None
    target = parse_database_url(database_url)
    try:
        run_manage("start", environment)
        opener = build_opener()
        user = login(opener, BASE_URL, username, password)
        actor_id = user.get("id")
        require(isinstance(actor_id, str), "登录用户缺少 ID")
        fixture = create_performance_fixture(target, actor_id)
        results = [measure_case(opener, case) for case in CASES]
        require(all(item.max_queries > 0 for item in results), "Prisma 查询计数未启用")
        plans = explain_plans(database_url)
        report_path = write_reports(results, plans)
        failures = [item.name for item in results if (
            item.p95_ms > 2000 or item.max_queries > 20 or item.rows > 100 or item.error_rate > 0
        )]
        failures.extend(item.name for item in plans if item.access_type == "ALL" and item.estimated_rows > 1000)
        require(not failures, f"性能预算未通过: {', '.join(failures)}")
        print(f"API 与数据库性能预算通过，报告: {report_path}")
        return 0
    finally:
        if fixture is not None:
            cleanup_performance_fixture(target, fixture)
        run_manage("stop", environment)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"API 与数据库性能检查失败: {error}", file=sys.stderr)
        raise SystemExit(1)
