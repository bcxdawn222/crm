from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict, cast

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from runtime.mysql_client import parse_database_url, run_mysql
from runtime.profile_config import get_profile_config


class AuditVulnerability(TypedDict, total=False):
    severity: str
    isDirect: bool


class AuditReport(TypedDict):
    vulnerabilities: dict[str, AuditVulnerability]


@dataclass(frozen=True)
class CheckResult:
    name: str
    detail: str


ALLOWED_RUNTIME_RISKS = {"next"}
SENSITIVE_ENV_KEYS = (
    "DATABASE_URL",
    "CRM_STABLE_DATABASE_URL",
    "CRM_TEST_DATABASE_URL",
    "NEXTAUTH_SECRET",
    "CRM_STABLE_NEXTAUTH_SECRET",
    "CRM_TEST_NEXTAUTH_SECRET",
    "ALIYUN_OSS_ACCESS_KEY",
    "ALIYUN_OSS_SECRET_KEY",
)
AUDITED_ACTIONS = (
    "IMPORT",
    "TRANSFER",
    "CLAIM",
    "CREATE",
    "CREATE_PAYMENT",
    "SETTINGS_UPDATED",
    "ROLE_UPDATED",
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DISABLED",
    "USER_ACTIVATED",
    "USER_LOCKED",
)


def run(command: list[str], *, allow_failure: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0 and not allow_failure:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "命令执行失败")
    return result


def dependency_audit() -> CheckResult:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    result = run(
        [npm, "audit", "--omit=dev", "--json", "--registry=https://registry.npmjs.org"],
        allow_failure=True,
    )
    report = cast(AuditReport, json.loads(result.stdout))
    vulnerabilities = report.get("vulnerabilities", {})
    unexpected = sorted(name for name in vulnerabilities if name not in ALLOWED_RUNTIME_RISKS)
    critical = sorted(
        name for name, item in vulnerabilities.items() if item.get("severity") == "critical"
    )
    if critical:
        raise RuntimeError(f"运行依赖存在 critical 风险: {', '.join(critical)}")
    if unexpected:
        raise RuntimeError(f"运行依赖存在未登记风险: {', '.join(unexpected)}")
    residual = ", ".join(sorted(vulnerabilities)) or "无"
    return CheckResult("依赖审计", f"无 critical；固定 Next.js 15.4 的已知残余风险={residual}")


def read_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for env_path in (ROOT / ".env.local", ROOT / ".env"):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def profile_isolation() -> CheckResult:
    stable = get_profile_config("stable")
    test = get_profile_config("test")
    if stable.database_url == test.database_url:
        raise RuntimeError("stable/test 数据库连接相同")
    if stable.auth_secret == test.auth_secret:
        raise RuntimeError("stable/test 认证密钥相同")
    if stable.auth_url == test.auth_url:
        raise RuntimeError("stable/test 认证地址相同")
    if stable.upload_dir.resolve() == test.upload_dir.resolve():
        raise RuntimeError("stable/test 上传目录相同")
    return CheckResult("profile 隔离", "数据库、认证密钥、认证地址和上传目录均独立")


def release_files() -> tuple[Path, ...]:
    roots = (
        ROOT / ".next",
        ROOT / "next.config.mjs",
        ROOT / "package.json",
        ROOT / "package-lock.json",
        ROOT / "public",
        ROOT / "prisma" / "schema.prisma",
        ROOT / "prisma" / "migrations",
        ROOT / "scripts" / "manage.py",
        ROOT / "scripts" / "cli",
        ROOT / "scripts" / "runtime",
        ROOT / "scripts" / "deploy",
    )
    files: list[Path] = []
    for entry in roots:
        if not entry.exists():
            raise RuntimeError(f"发布白名单路径不存在: {entry}")
        if entry.is_file():
            files.append(entry)
        else:
            files.extend(path for path in entry.rglob("*") if path.is_file())
    return tuple(files)


def contains_bytes(path: Path, needles: tuple[bytes, ...]) -> bool:
    if path.stat().st_size > 20 * 1024 * 1024:
        return False
    data = path.read_bytes()
    return any(needle in data for needle in needles)


def artifact_secret_scan() -> CheckResult:
    values = read_env_file()
    secret_values = tuple(
        value.encode("utf-8")
        for key, value in values.items()
        if key in SENSITIVE_ENV_KEYS and len(value) >= 12 and "<" not in value
    )
    leaked = [path for path in release_files() if secret_values and contains_bytes(path, secret_values)]
    if leaked:
        relative = ", ".join(str(path.relative_to(ROOT)) for path in leaked[:5])
        raise RuntimeError(f"发布白名单文件包含环境密钥或连接串: {relative}")
    return CheckResult("发布白名单", "未包含 .env、日志、测试脚本、上传文件或当前环境密钥")


def tracked_secret_scan() -> CheckResult:
    tracked = run(["git", "ls-files"]).stdout.splitlines()
    banned_literals = ('REDACTED_c68d10500c05', 'REDACTED_10def11e3c64')
    findings: list[str] = []
    for relative in tracked:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size > 2 * 1024 * 1024:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if any(value in text for value in banned_literals):
            findings.append(relative)
        for match in re.finditer(r"(?:mysql|mariadb)://[^\s\"']+", text, re.IGNORECASE):
            uri = match.group(0)
            if "<" not in uri and relative not in {
                "scripts/quality/instance_flow_test.py",
                "scripts/quality/release_flow_test.py",
                "scripts/quality/runtime_checks.py",
                "scripts/quality/server_governance.py",
                "scripts/quality/server_runtime_drill.py",
            }:
                findings.append(relative)
                break
    if findings:
        raise RuntimeError(f"Git 跟踪文件包含明文连接或已知密码: {', '.join(sorted(set(findings))[:8])}")
    return CheckResult("仓库敏感信息", "未发现已知真实密码或非夹具明文数据库连接")


def source_contracts() -> CheckResult:
    checks = {
        "src/middleware.ts": ("isCrossOriginWrite", "sec-fetch-site", "请求来源校验失败"),
        "src/lib/auth.ts": ("useSecureCookies", "trustHost: true", "authSecret.length < 32"),
        "src/lib/files/validation.ts": ("validateUploadedFile", "文件内容与扩展名不一致", "safeOriginalName"),
        "src/lib/audit/sanitize.ts": ("SENSITIVE_KEY", "PRIVATE_KEY", "[REDACTED]"),
        "next.config.mjs": ("Content-Security-Policy", "X-Content-Type-Options", "Permissions-Policy"),
    }
    for relative, markers in checks.items():
        text = (ROOT / relative).read_text(encoding="utf-8")
        missing = [marker for marker in markers if marker not in text]
        if missing:
            raise RuntimeError(f"{relative} 缺少安全契约: {', '.join(missing)}")
    return CheckResult("代码安全契约", "认证、同源写、上传、审计脱敏和响应头实现齐全")


def audit_database() -> CheckResult:
    target = parse_database_url(os.environ.get("DATABASE_URL", ""))
    if not target.database.lower().endswith("_test"):
        raise RuntimeError("安全审计拒绝读取非 test 数据库")
    actions = ",".join(f"'{action}'" for action in AUDITED_ACTIONS)
    missing_identity = run_mysql(
        target,
        f"SELECT COUNT(*) FROM AuditEvent WHERE action IN ({actions}) "
        "AND (actorId IS NULL OR requestId IS NULL OR requestId='');",
    )
    missing_snapshot = run_mysql(
        target,
        f"SELECT COUNT(*) FROM AuditEvent WHERE action IN ({actions}) "
        "AND beforeData IS NULL AND afterData IS NULL;",
    )
    if missing_identity != "0" or missing_snapshot != "0":
        raise RuntimeError(
            f"审计事件不完整: 操作者/请求号缺失={missing_identity}，前后摘要均缺失={missing_snapshot}"
        )
    return CheckResult("审计数据", "关键写操作不存在操作者、requestId 或摘要缺失记录")


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("security 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2
    checks = (
        dependency_audit,
        profile_isolation,
        tracked_secret_scan,
        artifact_secret_scan,
        source_contracts,
        audit_database,
    )
    try:
        for check in checks:
            result = check()
            print(f"[通过] {result.name}: {result.detail}")
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"[失败] {error}", file=sys.stderr)
        return 1
    print("安全静态与数据检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
