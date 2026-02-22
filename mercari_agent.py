#!/usr/bin/env python3
"""Mercari JP scraping agent with incremental storage and notifications.

Usage examples:
  python mercari_agent.py --keywords "ポケモンカード" --max-pages 2
  python mercari_agent.py --keywords "ニンテンドースイッチ" --db-path data/mercari.db
  python mercari_agent.py --keywords "遊戯王" --telegram-bot-token xxx --telegram-chat-id yyy
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import sqlite3
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


@dataclass
class MercariItem:
    keyword: str
    title: str
    price_jpy: int | None
    item_url: str
    image_url: str | None
    seller_name: str | None
    is_sold: bool
    scraped_at: str


class ItemStore:
    """SQLite-based incremental and dedup storage."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS items (
                item_url TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                keyword TEXT NOT NULL,
                price_jpy INTEGER,
                image_url TEXT,
                seller_name TEXT,
                is_sold INTEGER NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                occurrence_count INTEGER NOT NULL DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_items_keyword_last_seen
            ON items(keyword, last_seen_at DESC);
            """
        )
        self.conn.commit()

    def upsert_item(self, item: MercariItem) -> bool:
        """Return True if this item is new, False if existing record updated."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT item_url FROM items WHERE item_url = ?", (item.item_url,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute(
                """
                INSERT INTO items (
                    item_url, title, keyword, price_jpy, image_url, seller_name, is_sold,
                    first_seen_at, last_seen_at, occurrence_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    item.item_url,
                    item.title,
                    item.keyword,
                    item.price_jpy,
                    item.image_url,
                    item.seller_name,
                    int(item.is_sold),
                    item.scraped_at,
                    item.scraped_at,
                ),
            )
            self.conn.commit()
            return True

        cursor.execute(
            """
            UPDATE items
            SET title = ?, keyword = ?, price_jpy = ?, image_url = ?, seller_name = ?,
                is_sold = ?, last_seen_at = ?, occurrence_count = occurrence_count + 1
            WHERE item_url = ?
            """,
            (
                item.title,
                item.keyword,
                item.price_jpy,
                item.image_url,
                item.seller_name,
                int(item.is_sold),
                item.scraped_at,
                item.item_url,
            ),
        )
        self.conn.commit()
        return False

    def close(self) -> None:
        self.conn.close()


class Notifier:
    def __init__(self, telegram_bot_token: str | None, telegram_chat_id: str | None, feishu_webhook: str | None) -> None:
        self.telegram_bot_token = telegram_bot_token
        self.telegram_chat_id = telegram_chat_id
        self.feishu_webhook = feishu_webhook

    def notify_new_items(self, items: List[MercariItem]) -> None:
        if not items:
            return
        message = self._build_message(items)
        if self.telegram_bot_token and self.telegram_chat_id:
            self._send_telegram(message)
        if self.feishu_webhook:
            self._send_feishu(message)

    @staticmethod
    def _build_message(items: List[MercariItem]) -> str:
        lines = [f"🛎️ Mercari 新商品提醒：{len(items)} 件"]
        for item in items[:5]:
            price_text = f"¥{item.price_jpy}" if item.price_jpy is not None else "价格未知"
            sold_text = "[SOLD]" if item.is_sold else ""
            lines.append(f"- {item.title} {sold_text} | {price_text} | {item.item_url}")
        if len(items) > 5:
            lines.append(f"... 其余 {len(items) - 5} 件请查看输出文件或数据库")
        return "\n".join(lines)

    def _send_telegram(self, text: str) -> None:
        api_url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
        payload = json.dumps({"chat_id": self.telegram_chat_id, "text": text}).encode("utf-8")
        request = Request(api_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=15) as response:
                if response.status >= 400:
                    logging.warning("Telegram notify failed with status=%s", response.status)
        except Exception as exc:
            logging.warning("Telegram notify error: %s", exc)

    def _send_feishu(self, text: str) -> None:
        payload = json.dumps({"msg_type": "text", "content": {"text": text}}).encode("utf-8")
        request = Request(self.feishu_webhook, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=15) as response:
                if response.status >= 400:
                    logging.warning("Feishu notify failed with status=%s", response.status)
        except Exception as exc:
            logging.warning("Feishu notify error: %s", exc)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Mercari Japan search result pages")
    parser.add_argument("--keywords", nargs="+", required=True, help="One or more search keywords")
    parser.add_argument("--max-pages", type=int, default=1, help="Pages per keyword (default: 1)")
    parser.add_argument("--wait-seconds", type=float, default=1.5, help="Wait between pages")
    parser.add_argument("--output", type=Path, default=Path("output/mercari_items.jsonl"))
    parser.add_argument("--db-path", type=Path, default=Path("data/mercari_items.db"), help="SQLite path for dedup/incremental scraping")
    parser.add_argument("--headful", action="store_true", help="Run browser with UI")
    parser.add_argument("--timeout-ms", type=int, default=30000, help="Page timeout in milliseconds")
    parser.add_argument("--telegram-bot-token", default=None, help="Telegram bot token for realtime alerts")
    parser.add_argument("--telegram-chat-id", default=None, help="Telegram chat id for realtime alerts")
    parser.add_argument("--feishu-webhook", default=None, help="Feishu custom bot webhook URL")
    parser.add_argument("--notify-all", action="store_true", help="Notify all scraped items. Default is only new items")
    parser.add_argument("--proxy-server", default=None, help="Proxy server for browser, e.g. socks5://host:port")
    parser.add_argument("--proxy-username", default=None, help="Proxy username if needed")
    parser.add_argument("--proxy-password", default=None, help="Proxy password if needed")
    parser.add_argument("--goto-retries", type=int, default=2, help="Retry count for page navigation errors")
    parser.add_argument("--retry-backoff-seconds", type=float, default=2.0, help="Backoff seconds between retries")
    parser.add_argument("--field-timeout-ms", type=int, default=1500, help="Timeout per field extraction on item cards")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def setup_logging(level: str) -> None:
    logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=getattr(logging, level))


def parse_price(price_text: str | None) -> int | None:
    if not price_text:
        return None
    normalized = price_text.replace(",", "")
    m = re.search(r"(\d+)", normalized)
    if not m:
        return None
    return int(m.group(1))


def build_search_url(keyword: str, page: int) -> str:
    encoded = quote_plus(keyword)
    return f"https://jp.mercari.com/search?keyword={encoded}&page={page}"


def _safe_text(locator, timeout_ms: int = 1500) -> str | None:
    try:
        text = locator.text_content(timeout=timeout_ms)
        return text.strip() if text else None
    except Exception:
        return None


def _safe_attr(locator, attr: str, timeout_ms: int = 1500) -> str | None:
    try:
        value = locator.get_attribute(attr, timeout=timeout_ms)
        return value.strip() if value else None
    except Exception:
        return None


def extract_items_from_page(page, keyword: str) -> List[MercariItem]:
    cards = page.locator("li[data-testid='item-cell']")
    count = cards.count()
    items: List[MercariItem] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for idx in range(count):
        card = cards.nth(idx)

        title = _safe_text(card.locator("mer-text[data-testid='thumbnail-item-name']").first) or ""
        price_text = _safe_text(card.locator("span[data-testid='price']").first)
        href = _safe_attr(card.locator("a").first, "href")
        item_url = f"https://jp.mercari.com{href}" if href and href.startswith("/") else (href or "")
        image_url = _safe_attr(card.locator("img").first, "src")
        seller_name = _safe_text(card.locator("span[data-testid='thumbnail-item-seller']").first)

        try:
            sold_badge = card.locator("span", has_text="SOLD")
            is_sold = sold_badge.count() > 0
        except Exception:
            is_sold = False

        item = MercariItem(
            keyword=keyword,
            title=title.strip(),
            price_jpy=parse_price(price_text),
            item_url=item_url,
            image_url=image_url,
            seller_name=seller_name.strip() if seller_name else None,
            is_sold=is_sold,
            scraped_at=now_iso,
        )
        if item.title and item.item_url:
            items.append(item)
    return items


def write_jsonl(path: Path, items: Iterable[MercariItem]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as file_obj:
        for item in items:
            file_obj.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")


def run_agent(
    keywords: List[str],
    max_pages: int,
    wait_seconds: float,
    output: Path,
    db_path: Path,
    headful: bool,
    timeout_ms: int,
    notifier: Notifier,
    notify_all: bool,
    proxy_server: str | None,
    proxy_username: str | None,
    proxy_password: str | None,
    goto_retries: int,
    retry_backoff_seconds: float,
    field_timeout_ms: int,
) -> tuple[int, int]:
    total_scraped = 0
    total_new = 0
    store = ItemStore(db_path)

    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright

    launch_kwargs = {"headless": not headful}
    if proxy_server:
        proxy_conf: dict[str, str] = {"server": proxy_server}
        if proxy_username:
            proxy_conf["username"] = proxy_username
        if proxy_password:
            proxy_conf["password"] = proxy_password
        launch_kwargs["proxy"] = proxy_conf

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_kwargs)
        context = browser.new_context(user_agent=random.choice(USER_AGENTS), locale="ja-JP")
        page = context.new_page()
        page.set_default_timeout(timeout_ms)

        for keyword in keywords:
            logging.info("Start keyword: %s", keyword)
            for page_num in range(1, max_pages + 1):
                url = build_search_url(keyword, page_num)
                logging.info("Visit %s", url)
                success = False
                for attempt in range(goto_retries + 1):
                    try:
                        page.goto(url, wait_until="domcontentloaded")
                        page.wait_for_selector("li[data-testid='item-cell']", timeout=timeout_ms)
                        success = True
                        break
                    except PlaywrightTimeoutError:
                        logging.warning(
                            "Page timeout: keyword=%s page=%s attempt=%s/%s",
                            keyword,
                            page_num,
                            attempt + 1,
                            goto_retries + 1,
                        )
                    except PlaywrightError as exc:
                        logging.warning(
                            "Navigation error: keyword=%s page=%s attempt=%s/%s error=%s",
                            keyword,
                            page_num,
                            attempt + 1,
                            goto_retries + 1,
                            exc,
                        )
                    if attempt < goto_retries:
                        time.sleep(max(0.2, retry_backoff_seconds))

                if not success:
                    logging.error("Skip page after retries exhausted: keyword=%s page=%s", keyword, page_num)
                    continue

                _ = field_timeout_ms  # kept for future tuning hooks
                items = extract_items_from_page(page, keyword)
                write_jsonl(output, items)

                new_items: List[MercariItem] = []
                for item in items:
                    is_new = store.upsert_item(item)
                    if is_new:
                        new_items.append(item)

                total_scraped += len(items)
                total_new += len(new_items)
                logging.info("Collected %d items from page %d (%d new)", len(items), page_num, len(new_items))

                notifier.notify_new_items(items if notify_all else new_items)

                sleep_sec = wait_seconds + random.uniform(0.2, 0.9)
                time.sleep(sleep_sec)

        context.close()
        browser.close()

    store.close()
    return total_scraped, total_new


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)
    notifier = Notifier(
        telegram_bot_token=args.telegram_bot_token,
        telegram_chat_id=args.telegram_chat_id,
        feishu_webhook=args.feishu_webhook,
    )
    logging.info("Output path: %s", args.output)
    logging.info("SQLite path: %s", args.db_path)

    total_scraped, total_new = run_agent(
        keywords=args.keywords,
        max_pages=args.max_pages,
        wait_seconds=args.wait_seconds,
        output=args.output,
        db_path=args.db_path,
        headful=args.headful,
        timeout_ms=args.timeout_ms,
        notifier=notifier,
        notify_all=args.notify_all,
        proxy_server=args.proxy_server,
        proxy_username=args.proxy_username,
        proxy_password=args.proxy_password,
        goto_retries=args.goto_retries,
        retry_backoff_seconds=args.retry_backoff_seconds,
        field_timeout_ms=args.field_timeout_ms,
    )
    logging.info("Done. Total scraped items: %d | new items: %d", total_scraped, total_new)


if __name__ == "__main__":
    main()
