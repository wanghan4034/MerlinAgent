#!/usr/bin/env python3
"""Simple SOCKS5 proxy connectivity checker."""

from __future__ import annotations

import os
import sys


def main() -> int:
    proxy_server = os.getenv("PROXY_SERVER", "socks5://host.docker.internal:10808")
    target_url = os.getenv("PROXY_CHECK_URL", "https://jp.mercari.com")
    timeout = float(os.getenv("PROXY_CHECK_TIMEOUT", "20"))

    try:
        import requests
        from requests.exceptions import ConnectTimeout, InvalidSchema, ProxyError, ReadTimeout
    except ModuleNotFoundError:
        print("代理连接失败: 未安装 requests 依赖。")
        print("请重建镜像或安装依赖: pip install -r requirements.txt")
        return 1

    proxies = {"http": proxy_server, "https": proxy_server}
    try:
        resp = requests.get(target_url, proxies=proxies, timeout=timeout)
        print(f"代理连接成功: status={resp.status_code}, url={target_url}, proxy={proxy_server}")
        return 0
    except InvalidSchema as exc:
        print(f"代理连接失败: {exc}")
        print("原因: 缺少 SOCKS 支持。请安装: pip install 'requests[socks]' 或 pip install PySocks")
        return 1
    except (ConnectTimeout, ReadTimeout) as exc:
        print(f"代理连接超时: {exc}")
        print("排查建议:")
        print("1) 确认 ShadowsocksX 已开启，且本地 SOCKS5 端口为 10808")
        print("2) 容器里使用 PROXY_SERVER=socks5://host.docker.internal:10808")
        print("3) 尝试增大超时: PROXY_CHECK_TIMEOUT=40 python3 tests/check_proxy.py")
        return 1
    except ProxyError as exc:
        print(f"代理连接失败(ProxyError): {exc}")
        print("排查建议: 检查 PROXY_SERVER 是否写错，及 ShadowsocksX 代理模式是否允许本机应用访问")
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"代理连接失败: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
