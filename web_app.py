#!/usr/bin/env python3
"""Web dashboard for Mercari scraping agent."""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

from mercari_agent import Notifier, run_agent

app = Flask(__name__)

JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_keywords(value: str) -> list[str]:
    return [word.strip() for word in value.split(",") if word.strip()]


def _fetch_stats(db_path: Path) -> dict[str, Any]:
    import sqlite3

    if not db_path.exists():
        return {
            "total_items": 0,
            "distinct_keywords": 0,
            "sold_items": 0,
            "last_seen_at": None,
        }

    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            """
            SELECT
              COUNT(*) AS total_items,
              COUNT(DISTINCT keyword) AS distinct_keywords,
              SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) AS sold_items,
              MAX(last_seen_at) AS last_seen_at
            FROM items
            """
        ).fetchone()
        return {
            "total_items": int(row[0] or 0),
            "distinct_keywords": int(row[1] or 0),
            "sold_items": int(row[2] or 0),
            "last_seen_at": row[3],
        }
    finally:
        conn.close()


def _fetch_recent_items(db_path: Path, limit: int = 50) -> list[dict[str, Any]]:
    import sqlite3

    if not db_path.exists():
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT item_url, title, keyword, price_jpy, seller_name, is_sold,
                   first_seen_at, last_seen_at, occurrence_count
            FROM items
            ORDER BY last_seen_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def _run_job(job_id: str, payload: dict[str, Any]) -> None:
    with JOBS_LOCK:
        JOBS[job_id]["status"] = "running"
        JOBS[job_id]["started_at"] = _utc_now()

    try:
        notifier = Notifier(
            telegram_bot_token=payload.get("telegram_bot_token") or None,
            telegram_chat_id=payload.get("telegram_chat_id") or None,
            feishu_webhook=payload.get("feishu_webhook") or None,
        )
        scraped, new_items = run_agent(
            keywords=payload["keywords"],
            max_pages=payload["max_pages"],
            wait_seconds=payload["wait_seconds"],
            output=Path(payload["output_path"]),
            db_path=Path(payload["db_path"]),
            headful=False,
            timeout_ms=payload["timeout_ms"],
            notifier=notifier,
            notify_all=payload["notify_all"],
        )
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["finished_at"] = _utc_now()
            JOBS[job_id]["result"] = {
                "total_scraped": scraped,
                "total_new": new_items,
            }
    except Exception as exc:  # noqa: BLE001
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["finished_at"] = _utc_now()
            JOBS[job_id]["error"] = str(exc)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/stats")
def api_stats():
    db_path = Path(request.args.get("db_path", "data/mercari_items.db"))
    return jsonify(_fetch_stats(db_path))


@app.get("/api/items")
def api_items():
    db_path = Path(request.args.get("db_path", "data/mercari_items.db"))
    limit = int(request.args.get("limit", "50"))
    limit = max(1, min(200, limit))
    return jsonify(_fetch_recent_items(db_path, limit=limit))


@app.post("/api/run")
def api_run():
    data = request.get_json(force=True)
    keywords = _parse_keywords(data.get("keywords", ""))
    if not keywords:
        return jsonify({"error": "keywords is required, split by comma"}), 400

    job_id = uuid.uuid4().hex
    payload = {
        "keywords": keywords,
        "max_pages": max(1, int(data.get("max_pages", 1))),
        "wait_seconds": max(0.1, float(data.get("wait_seconds", 1.5))),
        "timeout_ms": max(1000, int(data.get("timeout_ms", 30000))),
        "output_path": data.get("output_path", "output/mercari_items.jsonl"),
        "db_path": data.get("db_path", "data/mercari_items.db"),
        "notify_all": bool(data.get("notify_all", False)),
        "telegram_bot_token": data.get("telegram_bot_token", ""),
        "telegram_chat_id": data.get("telegram_chat_id", ""),
        "feishu_webhook": data.get("feishu_webhook", ""),
    }

    job_meta = {
        "job_id": job_id,
        "status": "queued",
        "created_at": _utc_now(),
        "payload": payload,
    }
    with JOBS_LOCK:
        JOBS[job_id] = job_meta

    thread = threading.Thread(target=_run_job, args=(job_id, payload), daemon=True)
    thread.start()

    return jsonify(job_meta), 202


@app.get("/api/job/<job_id>")
def api_job(job_id: str):
    with JOBS_LOCK:
        info = JOBS.get(job_id)
    if not info:
        return jsonify({"error": "job not found"}), 404
    return jsonify(info)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
