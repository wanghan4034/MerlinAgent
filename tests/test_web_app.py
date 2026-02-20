import importlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mercari_agent import ItemStore, MercariItem


class WebAppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            module = importlib.import_module("web_app")
        except ModuleNotFoundError as exc:
            raise unittest.SkipTest(f"flask/web app dependencies unavailable: {exc}")
        cls.module = module
        cls.app = module.app

    def setUp(self):
        self.client = self.app.test_client()

    def test_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        payload = resp.get_json()
        self.assertTrue(payload["ok"])

    def test_stats_and_items_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "empty.db"
            resp = self.client.get(f"/api/stats?db_path={db_path}")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["total_items"], 0)

            resp2 = self.client.get(f"/api/items?db_path={db_path}&limit=10")
            self.assertEqual(resp2.status_code, 200)
            self.assertEqual(resp2.get_json(), [])

    def test_stats_and_items_with_filters(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "items.db"
            store = ItemStore(db_path)
            item_a = MercariItem(
                keyword="abc",
                title="商品1",
                price_jpy=123,
                item_url="https://jp.mercari.com/item/xyz",
                image_url=None,
                seller_name="s1",
                is_sold=False,
                scraped_at="2026-01-01T00:00:00+00:00",
            )
            item_b = MercariItem(
                keyword="def",
                title="限定 商品2",
                price_jpy=999,
                item_url="https://jp.mercari.com/item/xyz2",
                image_url=None,
                seller_name="s2",
                is_sold=True,
                scraped_at="2026-01-01T01:00:00+00:00",
            )
            store.upsert_item(item_a)
            store.upsert_item(item_b)
            store.close()

            resp = self.client.get(f"/api/stats?db_path={db_path}")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["total_items"], 2)
            self.assertEqual(data["distinct_keywords"], 2)
            self.assertEqual(data["sold_items"], 1)

            resp2 = self.client.get(f"/api/items?db_path={db_path}&q=限定")
            items = resp2.get_json()
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["title"], "限定 商品2")

            resp3 = self.client.get(f"/api/items?db_path={db_path}&sold_only=1")
            sold_items = resp3.get_json()
            self.assertEqual(len(sold_items), 1)
            self.assertEqual(sold_items[0]["is_sold"], 1)

    def test_profile_crud(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            old_path = self.module.PROFILES_PATH
            self.module.PROFILES_PATH = Path(tmpdir) / "profiles.json"
            try:
                resp = self.client.post("/api/profiles", json={"name": "模板A", "config": {"a": 1}})
                self.assertEqual(resp.status_code, 200)

                resp2 = self.client.get("/api/profiles")
                data = resp2.get_json()
                self.assertIn("模板A", data)

                resp3 = self.client.delete("/api/profiles/%E6%A8%A1%E6%9D%BFA")
                self.assertEqual(resp3.status_code, 200)
            finally:
                self.module.PROFILES_PATH = old_path

    def test_run_requires_keywords(self):
        resp = self.client.post("/api/run", json={"keywords": ""})
        self.assertEqual(resp.status_code, 400)

    def test_index_page(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Mercari 爬虫可视化控制台 Pro", resp.get_data(as_text=True))

    def test_run_job_success_and_jobs_list(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = str(Path(tmpdir) / "items.db")
            out = str(Path(tmpdir) / "items.jsonl")
            with patch.object(self.module, "run_agent", return_value=(3, 2)):
                resp = self.client.post(
                    "/api/run",
                    json={
                        "keywords": "ポケモンカード,Switch",
                        "db_path": db_path,
                        "output_path": out,
                        "max_pages": 1,
                        "wait_seconds": 0.1,
                        "timeout_ms": 1000,
                    },
                )
            self.assertEqual(resp.status_code, 202)
            payload = resp.get_json()
            self.assertIn("job_id", payload)

            jobs = self.client.get("/api/jobs?limit=5").get_json()
            self.assertGreaterEqual(len(jobs), 1)


if __name__ == "__main__":
    unittest.main()
