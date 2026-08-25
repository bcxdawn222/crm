from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from runtime import instance_manager
from runtime.instance_state import InstanceInspection, InstanceKind, InstanceRecord, inspect_instance, write_instance_record
from runtime.profile_config import ProfileConfig, validate_profile_isolated


class InstanceFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="crm-instance-flow-")
        root = Path(self.temp_dir.name)
        self.config = ProfileConfig(
            name="test",
            app_host="127.0.0.1",
            app_port=3311,
            database_url="mysql://test:test@127.0.0.1:3307/crm_test",
            database_host="127.0.0.1",
            database_port=3307,
            upload_dir=root / "storage",
            log_dir=root / "logs",
            pid_file=root / "runtime" / "server.pid",
            lock_file=root / "runtime" / "server.lock",
            build_dir=root / "build",
        )
        self.config.pid_file.parent.mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_exclusive_lock_rejects_second_owner(self) -> None:
        instance_manager._acquire_lock(self.config)
        with self.assertRaises(RuntimeError):
            instance_manager._acquire_lock(self.config)

    def test_corrupt_record_is_reported_without_process_action(self) -> None:
        self.config.lock_file.write_text("pid=not-a-pid\n", encoding="utf-8")
        with patch("runtime.instance_state.is_port_open", return_value=False):
            inspection = inspect_instance(self.config)
        self.assertEqual(inspection.kind, InstanceKind.CORRUPT)
        self.assertIn("字段不完整", inspection.detail)

    def test_pid_and_lock_mismatch_is_corrupt(self) -> None:
        record = InstanceRecord(os.getpid(), "test", self.config.app_port, ROOT)
        write_instance_record(self.config.pid_file, record)
        write_instance_record(
            self.config.lock_file,
            InstanceRecord(os.getpid() + 1, "test", self.config.app_port, ROOT),
        )
        inspection = inspect_instance(self.config)
        self.assertEqual(inspection.kind, InstanceKind.CORRUPT)
        self.assertIn("不一致", inspection.detail)

    def test_stop_rejects_foreign_active_port(self) -> None:
        inspection = InstanceInspection(
            InstanceKind.FOREIGN_PID,
            9999,
            (9999,),
            "PID 已被其他进程复用",
        )
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.instance_manager.is_port_open", return_value=True
        ), patch("runtime.instance_manager.terminate_process_tree") as terminate:
            result = instance_manager.stop_server(Mock(), self.config)
        self.assertEqual(result, 1)
        terminate.assert_not_called()

    def test_stop_rejects_corrupt_record_even_when_port_is_free(self) -> None:
        inspection = InstanceInspection(InstanceKind.CORRUPT, None, (), "PID 文件与锁文件记录不一致")
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.instance_manager.is_port_open", return_value=False
        ):
            result = instance_manager.stop_server(Mock(), self.config)
        self.assertEqual(result, 1)

    def test_stop_cleans_stale_record_when_port_is_free(self) -> None:
        self.config.pid_file.write_text("stale", encoding="ascii")
        inspection = InstanceInspection(InstanceKind.STALE, 9999, (), "实例记录已陈旧")
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.instance_manager.is_port_open", return_value=False
        ):
            result = instance_manager.stop_server(Mock(), self.config)
        self.assertEqual(result, 0)
        self.assertFalse(self.config.pid_file.exists())
        self.assertFalse(self.config.lock_file.exists())

    def test_start_rejects_port_conflict_and_removes_its_lock(self) -> None:
        inspection = InstanceInspection(
            InstanceKind.PORT_CONFLICT,
            os.getpid(),
            (8888,),
            "监听端口不属于记录进程树",
        )
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.instance_manager.is_port_open", return_value=True
        ):
            result = instance_manager.start_server(Mock(), self.config)
        self.assertEqual(result, 1)
        self.assertFalse(self.config.lock_file.exists())

    def test_start_cleans_foreign_pid_only_when_port_is_free(self) -> None:
        record = InstanceRecord(os.getpid(), "test", self.config.app_port, ROOT)
        write_instance_record(self.config.pid_file, record)
        inspection = InstanceInspection(InstanceKind.FOREIGN_PID, os.getpid(), (), "PID 已被其他进程复用")
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.instance_manager.is_port_open", return_value=False
        ), patch("runtime.manager.start_database", return_value=1):
            result = instance_manager.start_server(Mock(), self.config)
        self.assertEqual(result, 1)
        self.assertFalse(self.config.pid_file.exists())
        self.assertFalse(self.config.lock_file.exists())

    def test_start_database_failure_removes_lock(self) -> None:
        inspection = InstanceInspection(InstanceKind.STARTING, os.getpid(), (), "当前管理进程正在启动")
        with patch("runtime.instance_manager.inspect_instance", return_value=inspection), patch(
            "runtime.manager.start_database", return_value=1
        ):
            result = instance_manager.start_server(Mock(), self.config)
        self.assertEqual(result, 1)
        self.assertFalse(self.config.lock_file.exists())
        self.assertFalse(self.config.pid_file.exists())

    def test_unwritable_runtime_directory_is_rejected(self) -> None:
        blocked = Path(self.temp_dir.name) / "blocked"
        blocked.write_text("not a directory", encoding="utf-8")
        config = ProfileConfig(
            name="test",
            app_host=self.config.app_host,
            app_port=self.config.app_port,
            database_url=self.config.database_url,
            database_host=self.config.database_host,
            database_port=self.config.database_port,
            upload_dir=blocked / "storage",
            log_dir=blocked / "logs",
            pid_file=blocked / "runtime" / "server.pid",
            lock_file=blocked / "runtime" / "server.lock",
            build_dir=blocked / "build",
        )
        with self.assertRaises(ValueError):
            validate_profile_isolated(config)
        self.assertEqual(instance_manager.start_server(Mock(), config), 2)
        self.assertFalse(config.lock_file.exists())


if __name__ == "__main__":
    raise SystemExit(unittest.main(verbosity=2))
