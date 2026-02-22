#!/usr/bin/env python3
"""SOCKS5 proxy connectivity checker with geo validation.

Default behavior checks whether egress city is Tokyo via ipinfo.
"""

from __future__ import annotations

import os
import sys


def main() -> int:
    proxy_server = os.getenv("PROXY_SERVER", "socks5://127.0.0.1:10808")
    target_url = os.getenv("PROXY_CHECK_URL", "https://ipinfo.io/json")
    timeout = float(os.getenv("PROXY_CHECK_TIMEOUT", "10"))
    expected_city = os.getenv("PROXY_EXPECTED_CITY", "Tokyo")

    try:
        import requests
        from requests.exceptions import ConnectTimeout, InvalidSchema, ProxyError, ReadTimeout
    except ModuleNotFoundError:
        print("代理连接失败: 未安装 requests 依赖。")
        print("请重建镜像或安装依赖: pip install -r requirements.txt")
        return 1

    proxies = {"http": proxy_server, "https": proxy_server}
    try:
        response = requests.get(target_url, proxies=proxies, timeout=timeout)
        response.raise_for_status()

        payload = response.json()
        city = payload.get("city")

        print(payload)
        if city == expected_city:
            print(f"代理验证通过: city={city}")
            return 0

        print(f"代理验证未通过: city={city}, expected={expected_city}")
        return 2
    except InvalidSchema as exc:
        print(f"代理连接失败: {exc}")
        print("原因: 缺少 SOCKS 支持。请安装: pip install 'requests[socks]' 或 pip install PySocks")
        return 1
    except (ConnectTimeout, ReadTimeout) as exc:
        print(f"代理连接超时: {exc}")
        print("排查建议: 1) 确认 ShadowsocksX 已开启且端口为 10808; 2) 容器内可尝试 host.docker.internal:10808; 3) 增大超时 PROXY_CHECK_TIMEOUT")
        return 1
    except ProxyError as exc:
        print(f"代理连接失败(ProxyError): {exc}")
        print("排查建议: 检查 PROXY_SERVER 是否正确，及代理模式是否允许本机应用访问")
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"代理连接失败: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
