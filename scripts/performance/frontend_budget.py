from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BUILD_LOG_DIR = ROOT / "logs" / "test"
REPORT_PATH = ROOT / "docs" / "前端性能预算.md"
ROUTE_PATTERN = re.compile(
    r"[┌├└] ○ (?P<route>/\S*)\s+\S+\s+kB\s+(?P<first_load>\d+(?:\.\d+)?)\s+kB"
)
SHARED_PATTERN = re.compile(r"First Load JS shared by all\s+(?P<size>\d+(?:\.\d+)?)\s+kB")


@dataclass(frozen=True)
class RouteBudget:
    route: str
    baseline_kb: float
    maximum_kb: float


@dataclass(frozen=True)
class RouteMeasurement:
    route: str
    first_load_kb: float


BUDGETS = (
    RouteBudget("/", 627.0, 350.0),
    RouteBudget("/statistics", 690.0, 300.0),
    RouteBudget("/public-pool", 724.0, 450.0),
)
GLOBAL_PAGE_MAXIMUM_KB = 500.0
SHARED_MAXIMUM_KB = 105.0
CLIENT_SOURCE_ROOT = ROOT / "src" / "app" / "(dashboard)"
HEAVY_IMPORT_RULES = {
    "echarts-for-react": {ROOT / "src" / "components" / "charts" / "CRMChart.tsx"},
    "from 'echarts/": {ROOT / "src" / "components" / "charts" / "CRMChart.tsx"},
    'from "echarts/': {ROOT / "src" / "components" / "charts" / "CRMChart.tsx"},
    "from 'xlsx'": set(),
    'from "xlsx"': set(),
}


def latest_build_log() -> Path:
    candidates = sorted(BUILD_LOG_DIR.glob("manage-build-*.log"), key=lambda path: path.stat().st_mtime)
    if not candidates:
        raise RuntimeError("没有找到 test 生产构建日志")
    return candidates[-1]


def parse_measurements(log_path: Path) -> tuple[tuple[RouteMeasurement, ...], float]:
    source = log_path.read_text(encoding="utf-8", errors="replace")
    measurements = tuple(
        RouteMeasurement(match.group("route"), float(match.group("first_load")))
        for match in ROUTE_PATTERN.finditer(source)
    )
    shared_match = SHARED_PATTERN.search(source)
    if not measurements or not shared_match:
        raise RuntimeError(f"构建日志缺少可解析的路由体积: {log_path}")
    return measurements, float(shared_match.group("size"))


def find_measurement(
    measurements: tuple[RouteMeasurement, ...],
    route: str,
) -> RouteMeasurement:
    for measurement in measurements:
        if measurement.route == route:
            return measurement
    raise RuntimeError(f"生产构建缺少路由: {route}")


def write_report(
    log_path: Path,
    measurements: tuple[RouteMeasurement, ...],
    shared_kb: float,
) -> None:
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    rows: list[str] = []
    for budget in BUDGETS:
        measurement = find_measurement(measurements, budget.route)
        reduction = (budget.baseline_kb - measurement.first_load_kb) / budget.baseline_kb * 100
        status = "通过" if measurement.first_load_kb <= budget.maximum_kb else "超限"
        rows.append(
            f"| `{budget.route}` | {budget.baseline_kb:.0f} kB | {measurement.first_load_kb:.1f} kB | "
            f"{reduction:.1f}% | {budget.maximum_kb:.0f} kB | {status} |"
        )
    route_rows = [
        f"| `{measurement.route}` | {measurement.first_load_kb:.1f} kB | "
        f"{'通过' if measurement.first_load_kb <= GLOBAL_PAGE_MAXIMUM_KB else '超限'} |"
        for measurement in measurements
    ]
    content = "\n".join((
        "# 前端性能预算",
        "",
        "> 本文档由 `python scripts\\manage.py perf --profile test` 根据最近一次生产构建日志生成。",
        "",
        f"- 构建日志：`{log_path}`",
        f"- 生成时间：{generated_at}",
        f"- 公共首屏 JavaScript：{shared_kb:.1f} kB，预算 {SHARED_MAXIMUM_KB:.0f} kB",
        "- 公共预算按 Next.js 15.4、React 19 与 Ant Design React 19 兼容补丁的实测框架基线制定。",
        f"- 全页面 First Load JS 上限：{GLOBAL_PAGE_MAXIMUM_KB:.0f} kB",
        "- LCP、INP、CLS、长任务和路由切换结果见 `docs/前端运行时性能.md`。",
        "",
        "| 路由 | 优化前 | 当前 | 降幅 | 预算 | 状态 |",
        "|---|---:|---:|---:|---:|---|",
        *rows,
        "",
        "## 全路由体积",
        "",
        "| 路由 | First Load JS | 状态 |",
        "|---|---:|---|",
        *route_rows,
        "",
        "## 重型依赖边界",
        "",
        "- ECharts 只允许从 `src/components/charts/CRMChart.tsx` 按需注册图表类型和 SVG renderer。",
        "- XLSX 只允许在服务端导入接口使用，不进入 Dashboard 客户端源码。",
        "- 当前没有使用 PDF 或富文本编辑器，未使用依赖已从运行依赖移除。",
        "- Dashboard 仅保留根布局的一处 Ant Design SSR registry 和一处会话 provider。",
        "",
    ))
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REPORT_PATH.open("w", encoding="utf-8", newline="\n") as report:
        report.write(content)


def check_import_boundaries() -> list[str]:
    failures: list[str] = []
    source_files = tuple((ROOT / "src").rglob("*.ts")) + tuple((ROOT / "src").rglob("*.tsx"))
    for marker, allowed_paths in HEAVY_IMPORT_RULES.items():
        for source_path in source_files:
            source = source_path.read_text(encoding="utf-8", errors="replace")
            is_client_xlsx = marker.endswith("xlsx'") or marker.endswith('xlsx"')
            if marker in source and source_path not in allowed_paths and (
                not is_client_xlsx or source_path.is_relative_to(CLIENT_SOURCE_ROOT)
            ):
                failures.append(f"重型依赖越界: {source_path.relative_to(ROOT)} ({marker})")
    package_data = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    dependencies = package_data.get("dependencies", {})
    for unused_dependency in ("@tiptap/react", "@tiptap/starter-kit", "react-pdf"):
        if unused_dependency in dependencies:
            failures.append(f"未使用的重型依赖仍在 dependencies: {unused_dependency}")
    return failures


def main() -> int:
    log_path = latest_build_log()
    measurements, shared_kb = parse_measurements(log_path)
    failures: list[str] = []
    for budget in BUDGETS:
        measurement = find_measurement(measurements, budget.route)
        if measurement.first_load_kb > budget.maximum_kb:
            failures.append(f"{budget.route}={measurement.first_load_kb:.1f}kB")
    oversized = tuple(item for item in measurements if item.first_load_kb > GLOBAL_PAGE_MAXIMUM_KB)
    failures.extend(f"{item.route}={item.first_load_kb:.1f}kB" for item in oversized)
    if shared_kb > SHARED_MAXIMUM_KB:
        failures.append(f"shared={shared_kb:.1f}kB")
    failures.extend(check_import_boundaries())
    write_report(log_path, measurements, shared_kb)
    if failures:
        print("前端性能预算超限: " + ", ".join(failures))
        return 1
    print(f"前端性能预算通过，报告: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"前端性能预算检查失败: {error}")
        raise SystemExit(1)
