import tempfile
import unittest
from pathlib import Path

from mercari_agent import ItemStore, MercariItem, Notifier, build_search_url, parse_price


class ParseHelpersTest(unittest.TestCase):
    def test_parse_price_valid(self):
        self.assertEqual(parse_price("¥12,345"), 12345)
        self.assertEqual(parse_price("1234円"), 1234)

    def test_parse_price_invalid(self):
        self.assertIsNone(parse_price(None))
        self.assertIsNone(parse_price("価格不明"))

    def test_build_search_url(self):
        url = build_search_url("ポケモン カード", 2)
        self.assertIn("keyword=%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3+%E3%82%AB%E3%83%BC%E3%83%89", url)
        self.assertTrue(url.endswith("&page=2"))


class ItemStoreTest(unittest.TestCase):
    def test_upsert_insert_then_update(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "items.db"
            store = ItemStore(db_path)

            item = MercariItem(
                keyword="switch",
                title="Nintendo Switch 本体",
                price_jpy=20000,
                item_url="https://jp.mercari.com/item/m123",
                image_url="https://img.example.com/1.jpg",
                seller_name="seller_a",
                is_sold=False,
                scraped_at="2026-02-19T00:00:00+00:00",
            )
            self.assertTrue(store.upsert_item(item))

            item2 = MercariItem(
                keyword="switch",
                title="Nintendo Switch 本体(値下げ)",
                price_jpy=19000,
                item_url="https://jp.mercari.com/item/m123",
                image_url="https://img.example.com/1.jpg",
                seller_name="seller_a",
                is_sold=True,
                scraped_at="2026-02-19T01:00:00+00:00",
            )
            self.assertFalse(store.upsert_item(item2))

            row = store.conn.execute(
                "SELECT title, price_jpy, is_sold, occurrence_count, first_seen_at, last_seen_at FROM items WHERE item_url = ?",
                (item.item_url,),
            ).fetchone()
            self.assertEqual(row[0], item2.title)
            self.assertEqual(row[1], item2.price_jpy)
            self.assertEqual(row[2], 1)
            self.assertEqual(row[3], 2)
            self.assertEqual(row[4], item.scraped_at)
            self.assertEqual(row[5], item2.scraped_at)

            store.close()


class NotifierMessageTest(unittest.TestCase):
    def test_build_message(self):
        items = [
            MercariItem(
                keyword="k",
                title="商品A",
                price_jpy=1000,
                item_url="https://jp.mercari.com/item/a",
                image_url=None,
                seller_name=None,
                is_sold=False,
                scraped_at="2026-02-19T00:00:00+00:00",
            ),
            MercariItem(
                keyword="k",
                title="商品B",
                price_jpy=None,
                item_url="https://jp.mercari.com/item/b",
                image_url=None,
                seller_name=None,
                is_sold=True,
                scraped_at="2026-02-19T00:00:00+00:00",
            ),
        ]
        msg = Notifier._build_message(items)
        self.assertIn("Mercari 新商品提醒：2 件", msg)
        self.assertIn("商品A", msg)
        self.assertIn("¥1000", msg)
        self.assertIn("商品B", msg)
        self.assertIn("价格未知", msg)
        self.assertIn("[SOLD]", msg)


if __name__ == "__main__":
    unittest.main()
