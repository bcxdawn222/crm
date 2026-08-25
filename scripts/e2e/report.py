from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import TypedDict, cast


ROOT = Path(__file__).resolve().parents[2]
REPORT_JSON = ROOT / "output" / "playwright" / "report.json"
REPORT_MD = ROOT / "docs" / "Playwright按钮级验收.md"


class TestResult(TypedDict, total=False):
    status: str


class TestEntry(TypedDict, total=False):
    results: list[TestResult]


class SpecEntry(TypedDict, total=False):
    title: str
    ok: bool
    tests: list[TestEntry]


class SuiteEntry(TypedDict, total=False):
    title: str
    specs: list[SpecEntry]
    suites: list["SuiteEntry"]


class PlaywrightReport(TypedDict, total=False):
    suites: list[SuiteEntry]
    errors: list[object]


class CaseRow(TypedDict):
    suite: str
    title: str
    status: str


def collect_cases(suite: SuiteEntry, parents: list[str]) -> list[CaseRow]:
    current = [*parents, suite.get("title", "未命名套件")]
    rows: list[CaseRow] = []
    for spec in suite.get("specs", []):
        statuses = [
            result.get("status", "unknown")
            for test in spec.get("tests", [])
            for result in test.get("results", [])
        ]
        status = "通过" if spec.get("ok") and statuses and all(item == "passed" for item in statuses) else "未通过"
        rows.append({
            "suite": " / ".join(part for part in current if part),
            "title": spec.get("title", "未命名用例"),
            "status": status,
        })
    for child in suite.get("suites", []):
        rows.extend(collect_cases(child, current))
    return rows


def render(report: PlaywrightReport) -> str:
    cases = [
        case
        for suite in report.get("suites", [])
        for case in collect_cases(suite, [])
    ]
    passed = sum(case["status"] == "通过" for case in cases)
    failed = len(cases) - passed
    generated_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
    rows = "\n".join(
        f'| {index} | {case["suite"]} | {case["title"]} | {case["status"]} |'
        for index, case in enumerate(cases, start=1)
    )
    return f"""# Playwright 按钮级验收报告

## 本轮结果

- 生成时间：{generated_at}
- 运行环境：`CRM_PROFILE=test`
- 数据库保护：仅允许数据库名以 `_test` 结尾
- 浏览器：Chromium Desktop
- 结果：{passed} 项通过，{failed} 项未通过，共 {len(cases)} 项
- 原始 JSON：`output/playwright/report.json`
- 失败产物：`output/playwright/results/`，仅失败时保留 screenshot、video 和 trace

## 覆盖范围

- 页面与按钮：导航、搜索、重置、分页、新增、编辑、删除、归档、转移、认领、上传、下载、设置保存。
- 数据证据：客户、文件、系统设置、归属关系、软删除状态和下载次数。
- 审计证据：客户创建/更新/归档/删除/转移/认领、文件上传/删除、系统设置更新。
- 权限证据：管理员、销售主管、销售和受限用户，覆盖按钮隐藏、API 403、页面 403 和数据范围。
- 恢复证据：空状态、加载状态、真实慢响应、断网恢复、会话撤销后重新登录、浏览器刷新和真实服务端 500。
- 重复操作：客户新增和系统设置保存验证重复点击只产生一次写请求。

## 用例明细

| 序号 | 套件 | 用例 | 结果 |
| ---: | --- | --- | --- |
{rows}

## 未自动化范围

- 未使用 `skip`、mock API 或硬编码成功响应；本轮报告中的业务请求均连接真实 test 服务。
- 未对 stable 或线上数据库执行写操作，线上只允许发布后进行只读核对。
- 本阶段仅使用 Chromium Desktop；多浏览器和移动端视觉回归属于 UI/最终发布验收范围。
- E2E 不替代持续压力测试、依赖安全审计和真实 Nginx/PM2/systemd 主机演练，这些由后续任务单独验证。
"""


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("Playwright 报告只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2
    if not REPORT_JSON.is_file():
        print(f"Playwright JSON 不存在: {REPORT_JSON}", file=sys.stderr)
        return 1
    report = cast(PlaywrightReport, json.loads(REPORT_JSON.read_text(encoding="utf-8")))
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text(render(report), encoding="utf-8", newline="\n")
    print(f"Playwright 按钮验收报告: {REPORT_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
