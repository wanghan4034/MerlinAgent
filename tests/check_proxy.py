#!/usr/bin/env python3
"""Simple SOCKS5 proxy connectivity checker.

Usage:
  python3 tests/check_proxy.py
  PROXY_SERVER=socks5://host.docker.internal:10808 python3 tests/check_proxy.py
"""

from __future__ import annotations

import os
import sys



def main() -> int:
    proxy_server = os.getenv("PROXY_SERVER", "socks5://host.docker.internal:10808")
    target_url = os.getenv("PROXY_CHECK_URL", "https://jp.mercari.com")

    try:
        import requests
    except ModuleNotFoundError:
        print("代理连接失败: 未安装 requests 依赖。")
        print("请先重建容器或安装依赖: pip install -r requirements.txt")
        return 1

    proxies = {"http": proxy_server, "https": proxy_server}
    try:
        resp = requests.get(target_url, proxies=proxies, timeout=20)
        print(f"代理连接成功: status={resp.status_code}, url={target_url}, proxy={proxy_server}")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"代理连接失败: {exc}")
        print("提示: 若报 Missing dependencies for SOCKS support，请安装 PySocks 或 requests[socks]。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
