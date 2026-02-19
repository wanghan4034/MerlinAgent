#!/usr/bin/env python3
"""Mercari JP scraping agent.

Usage examples:
  python mercari_agent.py --keywords "ポケモンカード" --max-pages 2
  python mercari_agent.py --keywords "ニンテンドースイッチ" "遊戯王" --headful
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List
from urllib.parse import quote_plus

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Mercari Japan search result pages")
    parser.add_argument("--keywords", nargs="+", required=True, help="One or more search keywords")
    parser.add_argument("--max-pages", type=int, default=1, help="Pages per keyword (default: 1)")
    parser.add_argument("--wait-seconds", type=float, default=1.5, help="Wait between pages")
    parser.add_argument("--output", type=Path, default=Path("output/mercari_items.jsonl"))
    parser.add_argument("--headful", action="store_true", help="Run browser with UI")
    parser.add_argument("--timeout-ms", type=int, default=30000, help="Page timeout in milliseconds")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def setup_logging(level: str) -> None:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        level=getattr(logging, level),
    )


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


def extract_items_from_page(page, keyword: str) -> List[MercariItem]:
    cards = page.locator("li[data-testid='item-cell']")
    count = cards.count()
    items: List[MercariItem] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for idx in range(count):
        card = cards.nth(idx)

        title = card.locator("mer-text[data-testid='thumbnail-item-name']").first.text_content() or ""
        price_text = card.locator("span[data-testid='price']").first.text_content()

        link_el = card.locator("a").first
        href = link_el.get_attribute("href")
        item_url = f"https://jp.mercari.com{href}" if href and href.startswith("/") else (href or "")

        image_url = card.locator("img").first.get_attribute("src")
        seller_name = card.locator("span[data-testid='thumbnail-item-seller']").first.text_content()

        sold_badge = card.locator("span", has_text="SOLD")
        is_sold = sold_badge.count() > 0

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
    with path.open("a", encoding="utf-8") as f:
        for item in items:
            f.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")


def run_agent(
    keywords: List[str],
    max_pages: int,
    wait_seconds: float,
    output: Path,
    headful: bool,
    timeout_ms: int,
) -> int:
    total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headful)
        context = browser.new_context(user_agent=random.choice(USER_AGENTS), locale="ja-JP")
        page = context.new_page()
        page.set_default_timeout(timeout_ms)

        for keyword in keywords:
            logging.info("Start keyword: %s", keyword)
            for page_num in range(1, max_pages + 1):
                url = build_search_url(keyword, page_num)
                logging.info("Visit %s", url)
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_selector("li[data-testid='item-cell']", timeout=timeout_ms)
                except PlaywrightTimeoutError:
                    logging.warning("Page timeout: keyword=%s page=%s", keyword, page_num)
                    continue

                items = extract_items_from_page(page, keyword)
                write_jsonl(output, items)
                total += len(items)
                logging.info("Collected %d items from page %d", len(items), page_num)

                sleep_sec = wait_seconds + random.uniform(0.2, 0.9)
                time.sleep(sleep_sec)

        context.close()
        browser.close()

    return total


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)
    logging.info("Output path: %s", args.output)

    collected = run_agent(
        keywords=args.keywords,
        max_pages=args.max_pages,
        wait_seconds=args.wait_seconds,
        output=args.output,
        headful=args.headful,
        timeout_ms=args.timeout_ms,
    )
    logging.info("Done. Total collected items: %d", collected)


if __name__ == "__main__":
    main()
