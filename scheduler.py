#!/usr/bin/env python3
"""In-container periodic scheduler for Mercari scraping."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

from mercari_agent import Notifier, run_agent

DEFAULT_CONFIG_PATH = Path("config/scheduler.json")


def load_scheduler_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Scheduler config not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if "keywords" not in data or not isinstance(data["keywords"], list) or not data["keywords"]:
        raise ValueError("scheduler config requires non-empty list field: keywords")
    interval_minutes = float(data.get("interval_minutes", 15))
    if interval_minutes <= 0:
        raise ValueError("interval_minutes must be > 0")
    data["interval_minutes"] = interval_minutes
    data.setdefault("max_pages", 1)
    data.setdefault("wait_seconds", 1.5)
    data.setdefault("timeout_ms", 30000)
    data.setdefault("output_path", "output/mercari_items.jsonl")
    data.setdefault("db_path", "data/mercari_items.db")
    data.setdefault("notify_all", False)
    data.setdefault("enabled", True)
    return data


def run_once(config: dict[str, Any]) -> tuple[int, int]:
    notifier = Notifier(
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN") or config.get("telegram_bot_token"),
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID") or config.get("telegram_chat_id"),
        feishu_webhook=os.getenv("FEISHU_WEBHOOK") or config.get("feishu_webhook"),
    )
    return run_agent(
        keywords=config["keywords"],
        max_pages=int(config["max_pages"]),
        wait_seconds=float(config["wait_seconds"]),
        output=Path(config["output_path"]),
        db_path=Path(config["db_path"]),
        headful=False,
        timeout_ms=int(config["timeout_ms"]),
        notifier=notifier,
        notify_all=bool(config.get("notify_all", False)),
        proxy_server=os.getenv("PROXY_SERVER") or config.get("proxy_server"),
        proxy_username=os.getenv("PROXY_USERNAME") or config.get("proxy_username"),
        proxy_password=os.getenv("PROXY_PASSWORD") or config.get("proxy_password"),
    )


def scheduler_loop(config_path: Path) -> None:
    logging.info("Scheduler loop started with config: %s", config_path)
    while True:
        try:
            config = load_scheduler_config(config_path)
            if not config.get("enabled", True):
                logging.info("Scheduler disabled in config, skip this round")
            else:
                scraped, new_items = run_once(config)
                logging.info(
                    "Scheduler run done: scraped=%s new=%s next in %s min",
                    scraped,
                    new_items,
                    config["interval_minutes"],
                )
            sleep_seconds = int(float(config.get("interval_minutes", 15)) * 60)
        except Exception as exc:  # noqa: BLE001
            logging.exception("Scheduler run failed: %s", exc)
            sleep_seconds = 60
        time.sleep(max(5, sleep_seconds))


def start_scheduler_thread(config_path: Path) -> threading.Thread:
    thread = threading.Thread(target=scheduler_loop, args=(config_path,), daemon=True)
    thread.start()
    return thread
