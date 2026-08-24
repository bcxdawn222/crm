from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ReachabilityContract:
    name: str
    page: str
    route: str
    implementation: str
    model: str
    audit_token: str


CONTRACTS = (
    ReachabilityContract(
        "客户创建", "src/app/(dashboard)/customers/page.tsx", "src/app/api/customers/route.ts",
        "src/app/api/customers/route.ts", "Customer", "CUSTOMER_CREATED",
    ),
    ReachabilityContract(
        "客户跟进", "src/app/(dashboard)/customers/page.tsx", "src/app/api/customers/[id]/follow-ups/route.ts",
        "src/app/api/customers/[id]/follow-ups/route.ts", "FollowUp", "FOLLOW_UP_CREATED",
    ),
    ReachabilityContract(
        "订单创建", "src/app/(dashboard)/finance/orders/page.tsx", "src/app/api/finance/orders/route.ts",
        "src/lib/orders/create.ts", "Order", "ORDER_CREATED",
    ),
    ReachabilityContract(
        "回款登记", "src/app/(dashboard)/finance/payments/page.tsx", "src/app/api/finance/payments/route.ts",
        "src/lib/payments/create.ts", "Payment", "PAYMENT_CREATED",
    ),
    ReachabilityContract(
        "合同备案", "src/app/(dashboard)/customers/page.tsx", "src/app/api/customers/[id]/contract-archives/route.ts",
        "src/lib/contracts/archive.ts", "ContractArchive", "CONTRACT_ARCHIVED",
    ),
    ReachabilityContract(
        "文件上传删除", "src/app/(dashboard)/files/page.tsx", "src/app/api/files/route.ts",
        "src/app/api/files/route.ts", "File", "FILE_UPLOADED",
    ),
    ReachabilityContract(
        "消息已读删除", "src/app/(dashboard)/messages/page.tsx", "src/app/api/messages/[id]/route.ts",
        "src/app/api/messages/[id]/route.ts", "Message", "MESSAGE_READ",
    ),
    ReachabilityContract(
        "电销转客户", "src/app/(dashboard)/telemarketing/page.tsx", "src/app/api/telemarketing/convert/route.ts",
        "src/lib/telemarketing/convert.ts", "Customer", "TELEMARKETING_CONVERTED",
    ),
    ReachabilityContract(
        "客户转移", "src/app/(dashboard)/customers/page.tsx", "src/app/api/customers/[id]/transfer/route.ts",
        "src/lib/customers/transfer.ts", "Customer", "CUSTOMER_TRANSFERRED",
    ),
    ReachabilityContract(
        "公海认领", "src/app/(dashboard)/public-pool/page.tsx", "src/app/api/public-pool/claim/route.ts",
        "src/lib/public-pool/claim.ts", "Customer", "PUBLIC_POOL_CLAIM",
    ),
    ReachabilityContract(
        "客户导入", "src/app/(dashboard)/customers/page.tsx", "src/app/api/customers/import/route.ts",
        "src/lib/customers/import.ts", "Customer", "CUSTOMERS_IMPORTED",
    ),
    ReachabilityContract(
        "合作客户更新", "src/app/(dashboard)/customers/cooperating/page.tsx", "src/app/api/customers/cooperating/route.ts",
        "src/app/api/customers/cooperating/route.ts", "Customer", "COOPERATING_CUSTOMER_UPDATED",
    ),
)


def run_reachability_contracts(root: Path) -> int:
    schema = (root / "prisma/schema.prisma").read_text(encoding="utf-8")
    failures = 0
    for contract in CONTRACTS:
        missing: list[str] = []
        page = root / contract.page
        route = root / contract.route
        implementation = root / contract.implementation
        if not page.is_file():
            missing.append(f"页面 {contract.page}")
        if not route.is_file():
            missing.append(f"接口 {contract.route}")
        if not implementation.is_file():
            missing.append(f"规则 {contract.implementation}")
        if f"model {contract.model} " not in schema:
            missing.append(f"模型 {contract.model}")
        sources = "\n".join(
            file.read_text(encoding="utf-8")
            for file in (route, implementation)
            if file.is_file()
        )
        if contract.audit_token not in sources:
            missing.append(f"审计 {contract.audit_token}")
        if missing:
            failures += 1
            print(f"链路契约失败 [{contract.name}]: {'; '.join(missing)}")
        else:
            print(
                f"链路契约通过 [{contract.name}]: 页面 -> API -> 规则 -> {contract.model} -> {contract.audit_token}"
            )
    return 1 if failures else 0
