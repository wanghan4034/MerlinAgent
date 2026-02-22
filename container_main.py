#!/usr/bin/env python3
"""Container entrypoint: start scheduler + web app."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from scheduler import DEFAULT_CONFIG_PATH, start_scheduler_thread
from web_app import app


def main() -> None:
    logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
    config_path = Path(os.getenv("SCHEDULER_CONFIG", str(DEFAULT_CONFIG_PATH)))
    start_scheduler_thread(config_path)
    app.run(host="0.0.0.0", port=8000, debug=False)


if __name__ == "__main__":
    main()
