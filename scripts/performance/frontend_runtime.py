from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NODE_SCRIPT = Path(__file__).with_name("frontend_runtime.mjs")


@dataclass(frozen=True)
class RuntimeConfig:
    node: str
    chrome: Path
    base_url: str


def find_chrome() -> Path:
    configured = os.environ.get("CRM_CHROME_PATH", "").strip()
    candidates = (
        Path(configured) if configured else None,
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    )
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate.resolve()
    raise RuntimeError("没有找到 Google Chrome，请设置 CRM_CHROME_PATH")


def load_config() -> RuntimeConfig:
    if os.environ.get("CRM_PROFILE") != "test":
        raise RuntimeError("前端运行时性能检查只允许 test profile")
    if not os.environ.get("CRM_PERF_USERNAME") or not os.environ.get("CRM_PERF_PASSWORD"):
        raise RuntimeError("缺少 CRM_PERF_USERNAME 或 CRM_PERF_PASSWORD")
    node = shutil.which("node")
    if not node:
        raise RuntimeError("没有找到 node")
    base_url = os.environ.get("CRM_PERF_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
    return RuntimeConfig(node=node, chrome=find_chrome(), base_url=base_url)


def main() -> int:
    config = load_config()
    os.environ["CRM_CHROME_PATH"] = str(config.chrome)
    os.environ["CRM_PERF_BASE_URL"] = config.base_url
    result = subprocess.run(
        [config.node, str(NODE_SCRIPT)],
        cwd=ROOT,
        env=os.environ,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"前端运行时性能检查失败: {error}")
        raise SystemExit(1)
