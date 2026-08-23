from __future__ import annotations

import logging
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def run_route_check(logger: logging.Logger) -> int:
    required_routes = (
        ROOT / "src/app/api/customers/renewal-reminders/route.ts",
        ROOT / "src/app/api/public-pool/claim/route.ts",
        ROOT / "src/app/api/tasks/assignees/route.ts",
    )
    for path in required_routes:
        if not path.exists():
            logger.error("路由文件不存在: %s", path)
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
    order_form = (
        ROOT / "src/app/(dashboard)/finance/orders/order-form-modal.tsx"
    ).read_text(encoding="utf-8")
    tasks_page = (ROOT / "src/app/(dashboard)/tasks/page.tsx").read_text(encoding="utf-8")
    task_form = (ROOT / "src/app/(dashboard)/tasks/task-form-modal.tsx").read_text(
        encoding="utf-8"
    )
    order_api = (ROOT / "src/app/api/finance/orders/route.ts").read_text(encoding="utf-8")
    task_api = (ROOT / "src/app/api/tasks/route.ts").read_text(encoding="utf-8")
    assignee_api = (ROOT / "src/app/api/tasks/assignees/route.ts").read_text(
        encoding="utf-8"
    )
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
