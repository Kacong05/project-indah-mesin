import base64
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import mqtt_bridge


class CompletedCsvProtocolTest(unittest.TestCase):
    def setUp(self):
        mqtt_bridge._csv_uploads.clear()
        mqtt_bridge._csv_active_imports.clear()
        mqtt_bridge._csv_waiters.clear()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.original_csv_dir = mqtt_bridge._csv_dir
        mqtt_bridge._csv_dir = Path(self.temp_dir.name)
        self.addCleanup(self._restore_csv_dir)

    def _restore_csv_dir(self):
        mqtt_bridge._csv_dir = self.original_csv_dir
        mqtt_bridge._csv_uploads.clear()
        mqtt_bridge._csv_active_imports.clear()
        mqtt_bridge._csv_waiters.clear()

    def test_completed_csv_is_reassembled_verified_imported_and_acked(self):
        machine = "RT-TEST"
        filename = "20260714_203949.csv"
        content = (
            b"Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging\n"
            b"7/14/2026 8:39:49PM,121.2,121.1,"
            b"2026-07-14T20:39:49+07:00,HOLDING,40.0,1,1\n"
        )
        digest = hashlib.sha256(content).hexdigest()
        transfer_id = "transfer-0001"
        key = (machine, filename, transfer_id)

        mqtt_bridge._handle_csv_message("retort/csv/meta", {
            "id": machine,
            "file": filename,
            "transfer_id": transfer_id,
            "size": len(content),
            "sha256": digest,
        })

        chunk_size = 17
        for index, offset in enumerate(range(0, len(content), chunk_size)):
            chunk = content[offset:offset + chunk_size]
            mqtt_bridge._handle_csv_message("retort/csv/chunk", {
                "id": machine,
                "file": filename,
                "transfer_id": transfer_id,
                "index": index,
                "data": base64.b64encode(chunk).decode("ascii"),
            })

        with patch.object(mqtt_bridge.threading, "Thread") as thread:
            mqtt_bridge._handle_csv_message("retort/csv/end", {
                "id": machine,
                "file": filename,
                "transfer_id": transfer_id,
                "size": len(content),
                "sha256": digest,
            })
            thread.assert_called_once()

        state = mqtt_bridge._csv_uploads[key]
        self.assertEqual(content, state["path"].read_bytes())

        response = Mock(status_code=200, content=b"{}")
        response.json.return_value = {
            "success": True,
            "data_count": 1,
        }
        with patch.object(mqtt_bridge.requests, "post", return_value=response), \
                patch.object(mqtt_bridge, "_publish_csv_ack") as publish_ack:
            mqtt_bridge._import_completed_csv(key)

        publish_ack.assert_called_once_with(machine, filename, transfer_id, "imported", "")
        self.assertNotIn(key, mqtt_bridge._csv_uploads)
        self.assertFalse(state["path"].exists())

    def test_retry_during_import_waits_for_same_result_without_second_upload(self):
        machine = "RT-TEST"
        filename = "20260714_213040.csv"
        first_transfer = "transfer-0001"
        retry_transfer = "transfer-0002"
        content = b"header\nvalue\n"
        digest = hashlib.sha256(content).hexdigest()
        first_key = (machine, filename, first_transfer)

        mqtt_bridge._handle_csv_message("retort/csv/meta", {
            "id": machine,
            "file": filename,
            "transfer_id": first_transfer,
            "size": len(content),
            "sha256": digest,
        })
        mqtt_bridge._handle_csv_message("retort/csv/chunk", {
            "id": machine,
            "file": filename,
            "transfer_id": first_transfer,
            "index": 0,
            "data": base64.b64encode(content).decode("ascii"),
        })
        with patch.object(mqtt_bridge.threading, "Thread") as thread:
            mqtt_bridge._handle_csv_message("retort/csv/end", {
                "id": machine,
                "file": filename,
                "transfer_id": first_transfer,
                "size": len(content),
                "sha256": digest,
            })
            thread.assert_called_once()

        with patch.object(mqtt_bridge, "_publish_csv_ack") as publish_ack:
            mqtt_bridge._handle_csv_message("retort/csv/meta", {
                "id": machine,
                "file": filename,
                "transfer_id": retry_transfer,
                "size": len(content),
                "sha256": digest,
            })
        publish_ack.assert_called_once_with(
            machine, filename, retry_transfer, "processing"
        )
        self.assertNotIn((machine, filename, retry_transfer), mqtt_bridge._csv_uploads)
        self.assertEqual(first_key, mqtt_bridge._csv_active_imports[(machine, filename)])
        self.assertEqual(
            {first_transfer, retry_transfer},
            mqtt_bridge._csv_waiters[(machine, filename)],
        )
        mqtt_bridge._handle_csv_message("retort/csv/chunk", {
            "id": machine,
            "file": filename,
            "transfer_id": retry_transfer,
            "index": 0,
            "data": base64.b64encode(content).decode("ascii"),
        })

        response = Mock(status_code=200)
        response.json.return_value = {"success": True, "data_count": 1}
        with patch.object(mqtt_bridge.requests, "post", return_value=response), \
                patch.object(mqtt_bridge, "_publish_csv_ack") as publish_ack:
            mqtt_bridge._import_completed_csv(first_key)

        self.assertEqual(2, publish_ack.call_count)
        acknowledged = {call.args[2] for call in publish_ack.call_args_list}
        self.assertEqual({first_transfer, retry_transfer}, acknowledged)
        for call in publish_ack.call_args_list:
            self.assertEqual("imported", call.args[3])
        self.assertNotIn((machine, filename), mqtt_bridge._csv_active_imports)
        self.assertNotIn((machine, filename), mqtt_bridge._csv_waiters)


if __name__ == "__main__":
    unittest.main()
