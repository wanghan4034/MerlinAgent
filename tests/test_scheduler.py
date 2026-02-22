import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scheduler


class SchedulerTest(unittest.TestCase):
    def test_load_scheduler_config_defaults(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scheduler.json"
            path.write_text(json.dumps({"keywords": ["a"], "interval_minutes": 15}), encoding="utf-8")
            cfg = scheduler.load_scheduler_config(path)
            self.assertEqual(cfg["keywords"], ["a"])
            self.assertEqual(cfg["max_pages"], 1)
            self.assertEqual(cfg["output_path"], "output/mercari_items.jsonl")
            self.assertEqual(cfg["goto_retries"], 2)
            self.assertEqual(cfg["retry_backoff_seconds"], 2.0)

    def test_load_scheduler_config_requires_keywords(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scheduler.json"
            path.write_text(json.dumps({"interval_minutes": 15}), encoding="utf-8")
            with self.assertRaises(ValueError):
                scheduler.load_scheduler_config(path)

    @patch("scheduler.run_agent", return_value=(10, 3))
    def test_run_once_calls_agent(self, mocked):
        cfg = {
            "keywords": ["x"],
            "max_pages": 1,
            "wait_seconds": 1.0,
            "timeout_ms": 30000,
            "output_path": "output/a.jsonl",
            "db_path": "data/a.db",
            "notify_all": False,
        }
        scraped, new_items = scheduler.run_once(cfg)
        self.assertEqual((scraped, new_items), (10, 3))
        mocked.assert_called_once()


if __name__ == "__main__":
    unittest.main()
