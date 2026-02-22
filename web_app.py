#!/usr/bin/env python3
"""Web dashboard for Mercari scraping agent."""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

from mercari_agent import Notifier, run_agent

app = Flask(__name__)

JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()
PROFILES_PATH = Path("data/ui_profiles.json")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_keywords(value: str) -> list[str]:
    return [word.strip() for word in value.split(",") if word.strip()]


def _safe_int(raw: str | None, default: int, lower: int | None = None, upper: int | None = None) -> int:
    try:
        value = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        value = default
    if lower is not None:
        value = max(lower, value)
    if upper is not None:
        value = min(upper, value)
    return value


def _safe_float(raw: str | None, default: float, lower: float | None = None) -> float:
    try:
        value = float(raw) if raw is not None else default
    except (TypeError, ValueError):
        value = default
    if lower is not None:
        value = max(lower, value)
    return value


def _read_profiles() -> dict[str, Any]:
    if not PROFILES_PATH.exists():
        return {}
    try:
        return json.loads(PROFILES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_profiles(payload: dict[str, Any]) -> None:
    PROFILES_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _fetch_stats(db_path: Path) -> dict[str, Any]:
    import sqlite3

    if not db_path.exists():
        return {
            "total_items": 0,
            "distinct_keywords": 0,
            "sold_items": 0,
            "avg_price": None,
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
              AVG(price_jpy) AS avg_price,
              MAX(last_seen_at) AS last_seen_at
            FROM items
            """
        ).fetchone()
        return {
            "total_items": int(row[0] or 0),
            "distinct_keywords": int(row[1] or 0),
            "sold_items": int(row[2] or 0),
            "avg_price": round(float(row[3]), 2) if row[3] is not None else None,
            "last_seen_at": row[4],
        }
    finally:
        conn.close()


def _fetch_recent_items(
    db_path: Path,
    *,
    limit: int = 50,
    keyword: str = "",
    sold_only: bool = False,
    min_price: int | None = None,
    max_price: int | None = None,
    query_text: str = "",
) -> list[dict[str, Any]]:
    import sqlite3

    if not db_path.exists():
        return []

    clauses = []
    args: list[Any] = []
    if keyword:
        clauses.append("keyword = ?")
        args.append(keyword)
    if sold_only:
        clauses.append("is_sold = 1")
    if min_price is not None:
        clauses.append("price_jpy >= ?")
        args.append(min_price)
    if max_price is not None:
        clauses.append("price_jpy <= ?")
        args.append(max_price)
    if query_text:
        clauses.append("title LIKE ?")
        args.append(f"%{query_text}%")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            f"""
            SELECT item_url, title, keyword, price_jpy, seller_name, is_sold,
                   image_url, first_seen_at, last_seen_at, occurrence_count
            FROM items
            {where_sql}
            ORDER BY COALESCE(last_seen_at, first_seen_at) DESC, first_seen_at DESC
            LIMIT ?
            """,
            (*args, limit),
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
            proxy_server=payload.get("proxy_server") or None,
            proxy_username=payload.get("proxy_username") or None,
            proxy_password=payload.get("proxy_password") or None,
            goto_retries=int(payload.get("goto_retries", 2)),
            retry_backoff_seconds=float(payload.get("retry_backoff_seconds", 2.0)),
            field_timeout_ms=int(payload.get("field_timeout_ms", 1500)),
            page_ready_wait_ms=int(payload.get("page_ready_wait_ms", 1200)),
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


@app.get("/api/health")
def api_health():
    return jsonify({"ok": True, "time": _utc_now()})


@app.get("/api/stats")
def api_stats():
    db_path = Path(request.args.get("db_path", "data/mercari_items.db"))
    return jsonify(_fetch_stats(db_path))


@app.get("/api/items")
def api_items():
    db_path = Path(request.args.get("db_path", "data/mercari_items.db"))
    limit = _safe_int(request.args.get("limit"), 50, 1, 200)
    min_price_raw = request.args.get("min_price")
    max_price_raw = request.args.get("max_price")
    min_price = _safe_int(min_price_raw, 0, 0) if min_price_raw else None
    max_price = _safe_int(max_price_raw, 0, 0) if max_price_raw else None
    sold_only = request.args.get("sold_only", "0") == "1"
    keyword = (request.args.get("keyword") or "").strip()
    query_text = (request.args.get("q") or "").strip()

    data = _fetch_recent_items(
        db_path,
        limit=limit,
        keyword=keyword,
        sold_only=sold_only,
        min_price=min_price,
        max_price=max_price,
        query_text=query_text,
    )
    return jsonify(data)


@app.post("/api/run")
def api_run():
    data = request.get_json(force=True)
    keywords = _parse_keywords(data.get("keywords", ""))
    if not keywords:
        return jsonify({"error": "keywords is required, split by comma"}), 400

    job_id = uuid.uuid4().hex
    payload = {
        "keywords": keywords,
        "max_pages": _safe_int(str(data.get("max_pages", 1)), 1, 1, 20),
        "wait_seconds": _safe_float(str(data.get("wait_seconds", 1.5)), 1.5, 0.1),
        "timeout_ms": _safe_int(str(data.get("timeout_ms", 30000)), 30000, 1000, 120000),
        "output_path": data.get("output_path", "output/mercari_items.jsonl"),
        "db_path": data.get("db_path", "data/mercari_items.db"),
        "notify_all": bool(data.get("notify_all", False)),
        "telegram_bot_token": data.get("telegram_bot_token", "") or os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "telegram_chat_id": data.get("telegram_chat_id", "") or os.getenv("TELEGRAM_CHAT_ID", ""),
        "feishu_webhook": data.get("feishu_webhook", "") or os.getenv("FEISHU_WEBHOOK", ""),
        "proxy_server": data.get("proxy_server", "") or os.getenv("PROXY_SERVER", ""),
        "proxy_username": data.get("proxy_username", "") or os.getenv("PROXY_USERNAME", ""),
        "proxy_password": data.get("proxy_password", "") or os.getenv("PROXY_PASSWORD", ""),
        "goto_retries": max(0, int(data.get("goto_retries", 2))),
        "retry_backoff_seconds": max(0.2, float(data.get("retry_backoff_seconds", 2.0))),
        "field_timeout_ms": max(300, int(data.get("field_timeout_ms", 1500))),
        "page_ready_wait_ms": max(200, int(data.get("page_ready_wait_ms", 1200))),
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


@app.get("/api/jobs")
def api_jobs():
    limit = _safe_int(request.args.get("limit"), 10, 1, 100)
    with JOBS_LOCK:
        rows = sorted(JOBS.values(), key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify(rows[:limit])


@app.get("/api/profiles")
def api_profiles():
    return jsonify(_read_profiles())


@app.post("/api/profiles")
def api_profiles_upsert():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    config = data.get("config")
    if not name:
        return jsonify({"error": "name is required"}), 400
    if not isinstance(config, dict):
        return jsonify({"error": "config should be JSON object"}), 400

    profiles = _read_profiles()
    profiles[name] = {"config": config, "updated_at": _utc_now()}
    _write_profiles(profiles)
    return jsonify({"ok": True, "name": name})


@app.delete("/api/profiles/<name>")
def api_profiles_delete(name: str):
    profiles = _read_profiles()
    if name not in profiles:
        return jsonify({"error": "profile not found"}), 404
    del profiles[name]
    _write_profiles(profiles)
    return jsonify({"ok": True, "name": name})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
