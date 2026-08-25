from __future__ import annotations

import json
import os
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Event
from time import sleep
from typing import TypedDict, cast


ROOT = Path(__file__).resolve().parents[2]


class ProcessRow(TypedDict, total=False):
    CPU: float
    WorkingSet64: int
    HandleCount: int


class MetricValues(TypedDict, total=False):
    count: float
    rate: float
    avg: float
    max: float
    med: float
    p_95: float
    p_99: float


@dataclass(frozen=True)
class ResourceSample:
    timestamp: str
    process_count: int
    cpu_seconds: float
    rss_mb: float
    handles: int
    database_connections: int
    server_log_bytes: int


@dataclass(frozen=True)
class K6Result:
    request_count: int
    request_rate: float
    iteration_count: int
    p95_ms: float
    p99_ms: float
    failure_rate: float
    check_rate: float
    write_p95_ms: float
    dropped_iterations: int


def _windows_stats(pids: set[int]) -> tuple[int, float, float, int]:
    pid_text = ",".join(str(pid) for pid in sorted(pids))
    command = (
        f"Get-Process -Id {pid_text} -ErrorAction SilentlyContinue | "
        "Select-Object CPU,WorkingSet64,HandleCount | ConvertTo-Json -Compress"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise RuntimeError("无法读取 CRM 进程资源数据")
    payload = json.loads(result.stdout)
    rows = payload if isinstance(payload, list) else [payload]
    typed_rows = cast(list[ProcessRow], rows)
    return (
        len(typed_rows),
        sum(float(row.get("CPU") or 0) for row in typed_rows),
        sum(int(row.get("WorkingSet64") or 0) for row in typed_rows) / 1024 / 1024,
        sum(int(row.get("HandleCount") or 0) for row in typed_rows),
    )


def _posix_stats(pids: set[int]) -> tuple[int, float, float, int]:
    result = subprocess.run(
        ["ps", "-o", "rss=,time=", "-p", ",".join(str(pid) for pid in sorted(pids))],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("无法读取 CRM 进程资源数据")
    rows = [line.split() for line in result.stdout.splitlines() if line.strip()]
    rss_mb = sum(int(row[0]) for row in rows) / 1024
    handles = 0
    for pid in pids:
        fd_dir = Path(f"/proc/{pid}/fd")
        if fd_dir.is_dir():
            handles += len(list(fd_dir.iterdir()))
    return len(rows), 0.0, rss_mb, handles


def collect_sample(
    pids: set[int],
    database_connections: int,
    server_log: Path,
) -> ResourceSample:
    process_count, cpu_seconds, rss_mb, handles = (
        _windows_stats(pids) if os.name == "nt" else _posix_stats(pids)
    )
    return ResourceSample(
        timestamp=datetime.now(timezone.utc).isoformat(),
        process_count=process_count,
        cpu_seconds=round(cpu_seconds, 3),
        rss_mb=round(rss_mb, 2),
        handles=handles,
        database_connections=database_connections,
        server_log_bytes=server_log.stat().st_size if server_log.exists() else 0,
    )


def sample_until_stopped(
    stop: Event,
    interval_seconds: int,
    sample_factory,
    output: list[ResourceSample],
) -> None:
    while not stop.is_set():
        output.append(sample_factory())
        stop.wait(interval_seconds)


def _metric_values(payload: object, metric_name: str) -> dict[str, float]:
    if not isinstance(payload, dict):
        raise RuntimeError("k6 summary 不是 JSON 对象")
    metrics = payload.get("metrics")
    if not isinstance(metrics, dict):
        raise RuntimeError("k6 summary 缺少 metrics")
    metric = metrics.get(metric_name)
    if metric is None:
        return {}
    if not isinstance(metric, dict) or not isinstance(metric.get("values"), dict):
        raise RuntimeError(f"k6 metric 格式错误: {metric_name}")
    values: dict[str, float] = {}
    for key, value in metric["values"].items():
        if isinstance(key, str) and isinstance(value, (int, float)):
            values[key] = float(value)
    return values


def load_k6_result(path: Path) -> K6Result:
    payload: object = json.loads(path.read_text(encoding="utf-8"))
    requests = _metric_values(payload, "http_reqs")
    iterations = _metric_values(payload, "iterations")
    duration = _metric_values(payload, "http_req_duration")
    failures = _metric_values(payload, "http_req_failed")
    checks = _metric_values(payload, "checks")
    writes = _metric_values(payload, "customer_write_duration")
    dropped = _metric_values(payload, "dropped_iterations")
    return K6Result(
        request_count=int(requests.get("count", 0)),
        request_rate=round(requests.get("rate", 0), 2),
        iteration_count=int(iterations.get("count", 0)),
        p95_ms=round(duration.get("p(95)", 0), 2),
        p99_ms=round(duration.get("p(99)", 0), 2),
        failure_rate=round(failures.get("rate", 0), 6),
        check_rate=round(checks.get("rate", 0), 6),
        write_p95_ms=round(writes.get("p(95)", 0), 2),
        dropped_iterations=int(dropped.get("count", 0)),
    )


def write_reports(
    k6_result: K6Result,
    samples: list[ResourceSample],
    restart_seconds: float,
    session_expiry_verified: bool,
    summary_path: Path,
) -> tuple[Path, Path]:
    generated_at = datetime.now(timezone.utc)
    timestamp = generated_at.strftime("%Y%m%dT%H%M%SZ")
    report_path = ROOT / "logs" / "test" / f"stability-performance-{timestamp}.json"
    document_path = ROOT / "docs" / "稳定性与压力测试.md"
    rss_values = [sample.rss_mb for sample in samples]
    handle_values = [sample.handles for sample in samples]
    db_values = [sample.database_connections for sample in samples]
    log_values = [sample.server_log_bytes for sample in samples]
    payload = {
        "generatedAt": generated_at.isoformat(),
        "profile": "test",
        "k6": asdict(k6_result),
        "resources": [asdict(sample) for sample in samples],
        "restartRecoverySeconds": restart_seconds,
        "sessionExpiryVerified": session_expiry_verified,
        "k6Summary": str(summary_path),
    }
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    document = f"""# 稳定性与压力测试

> 生成时间：{generated_at.isoformat()}；环境：test；测试数据均使用唯一标记并在结束后清理。

## 负载结果

- HTTP 请求数：{k6_result.request_count}，平均吞吐：{k6_result.request_rate:.2f} req/s。
- 请求 p95：{k6_result.p95_ms:.2f} ms，p99：{k6_result.p99_ms:.2f} ms，失败率：{k6_result.failure_rate:.3%}。
- 检查通过率：{k6_result.check_rate:.3%}，受控写入 p95：{k6_result.write_p95_ms:.2f} ms，丢弃迭代：{k6_result.dropped_iterations}。

## 运行资源

- 采样次数：{len(samples)}，内存范围：{min(rss_values):.2f} - {max(rss_values):.2f} MB。
- 句柄范围：{min(handle_values)} - {max(handle_values)}，数据库连接范围：{min(db_values)} - {max(db_values)}。
- 服务日志增长：{max(log_values) - min(log_values)} bytes。
- 服务重启恢复：{restart_seconds:.2f} 秒；真实会话过期复验：{'通过' if session_expiry_verified else '未通过'}。

## 验收预算

- HTTP p95 小于 1500 ms，p99 小于 3000 ms，失败率小于 1%，检查通过率大于 99%。
- 受控写入 p95 小于 2000 ms，丢弃迭代为 0。
- 进程内存增长小于 512 MB，句柄增长小于 500，数据库连接峰值不超过 50。
- 服务重启后 30 秒内恢复，过期会话返回 JSON 401，测试夹具和上传文件必须清理。

原始报告：`{report_path}`

k6 汇总：`{summary_path}`
"""
    with document_path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(document)
    return report_path, document_path
