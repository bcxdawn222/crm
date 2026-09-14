from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "权限与数据范围矩阵.md"


@dataclass(frozen=True)
class AccessContract:
    module: str
    page: str
    page_permission: str
    actions: str
    api: str
    data_scope: str


@dataclass(frozen=True)
class Evidence:
    path: str
    snippets: tuple[str, ...]


CONTRACTS = (
    AccessContract("客户", "/customers", "customer:view", "新增 customer:create；编辑/转移 customer:update", "/api/customers", "管理员/财务全局；主管本人及下属；销售本人；受限角色为空"),
    AccessContract("提醒", "/reminders", "customer:view", "跟进 followUp:create；禁用/恢复 customer:update", "/api/reminders", "按客户 salesId；计划跟进按 FollowUp.salesId 使用同一范围"),
    AccessContract("统计", "/statistics", "report:view", "只读", "/api/statistics/*", "订单、客户、回款、跟进均使用同一销售范围"),
    AccessContract("电销", "/telemarketing", "lead:view", "新增/导入 lead:create；编辑/删除 lead:update；转客户 lead:convert + customer:create", "/api/telemarketing", "管理员/财务全局；主管本人及下属；销售本人；按名单 salesId"),
    AccessContract("订单", "/finance/orders", "order:view", "新增 order:create；编辑 order:update；删除 order:cancel", "/api/finance/orders", "按 Order.salesId；新订单沿用客户 salesId"),
    AccessContract("回款", "/finance/payments", "payment:view", "新增 payment:create", "/api/finance/payments", "按 Payment.order.salesId；写入前校验订单范围"),
    AccessContract("财务报表", "/finance/reports", "report:view", "只读", "/api/finance/reports/summary", "按 Order.salesId"),
    AccessContract("日报", "/daily-reports", "report:daily:view", "提交 report:daily:create", "/api/daily-reports", "按 DailyReport.userId"),
    AccessContract("任务", "/tasks", "task:view", "创建 task:create", "/api/tasks", "按 Task.assigneeId"),
    AccessContract("文件", "/files", "file:view", "上传 file:upload；下载 file:download；删除 file:delete", "/api/files", "按 File.uploadedBy"),
    AccessContract("合同备案", "/customers/cooperating", "customer:view", "上传/删除 customer:update", "/api/contract-archives/*", "按合同所属客户 salesId；运营负责人本人可只读"),
    AccessContract("系统管理", "/admin/users、roles、settings", "各子页精确权限", "按 user/role/setting 权限", "/api/users、roles、settings", "管理数据，不使用销售范围"),
)

EVIDENCE = (
    Evidence("src/lib/access/page-access.ts", ("/admin/settings", "/reminders", "/telemarketing", "/messages")),
    Evidence("src/middleware.ts", ("hasPageAccess",)),
    Evidence("src/components/common/Sidebar.tsx", ("hasAnyPermission", "lead:view", "role:view")),
    Evidence("src/lib/data-permission.ts", ("getAccessibleUserIds", "return []", "return null")),
    Evidence("src/lib/auth.ts", ("loadActiveDatabaseUserById", "return currentUser ?")),
    Evidence("src/app/api/finance/payments/route.ts", ("getAccessibleUserIds", "accessibleOrder")),
    Evidence("src/app/api/files/[id]/route.ts", ("file:download", "canAccessSalesData")),
    Evidence("src/lib/contracts/access.ts", ("canReadContractArchive", "canWriteContractArchive")),
)


def verify_evidence() -> None:
    for evidence in EVIDENCE:
        path = ROOT / evidence.path
        if not path.exists():
            raise RuntimeError(f"权限证据文件不存在: {path}")
        content = path.read_text(encoding="utf-8")
        missing = tuple(snippet for snippet in evidence.snippets if snippet not in content)
        if missing:
            raise RuntimeError(f"权限证据缺失: {path} -> {', '.join(missing)}")


def render_document() -> str:
    lines = [
        "# CRM 权限与数据范围矩阵",
        "",
        "本文档对应当前代码权限契约。权限判断采用：页面入口、按钮、Route Handler、Prisma 数据范围四层同时校验。",
        "",
        "| 模块 | 页面 | 页面权限 | 动作权限 | API | 数据范围 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for contract in CONTRACTS:
        lines.append(
            f"| {contract.module} | `{contract.page}` | {contract.page_permission} | "
            f"{contract.actions} | `{contract.api}` | {contract.data_scope} |"
        )
    lines.extend((
        "",
        "## 角色范围",
        "",
        "- 管理员：拥有权限点覆盖的全部数据。",
        "- 财务：拥有权限点覆盖的全部数据；没有某项权限时仍返回 403。",
        "- 销售主管：仅本人及递归下属的数据。",
        "- 销售：仅本人及递归下属的数据；通常没有下属，因此表现为本人数据。",
        "- 自定义受限角色：只有功能权限但没有已声明数据范围时，查询结果为空，详情和写入返回 403。",
        "",
        "## 会话生效",
        "",
        "服务端每次执行 `auth()` 时重新读取 ACTIVE 用户、角色和权限。角色撤权立即作用于 API；用户停用后旧会话不能继续调用受保护 API。中间件只负责页面入口的快速判断，最终授权以 Route Handler 为准。",
        "",
    ))
    return "\n".join(lines)


def main() -> int:
    verify_evidence()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render_document(), encoding="utf-8", newline="\n")
    print(f"权限矩阵已生成: {OUTPUT}")
    print(f"权限契约数量: {len(CONTRACTS)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"权限矩阵检查失败: {error}", file=sys.stderr)
        raise SystemExit(1)
