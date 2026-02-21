import requests

proxies = {
    "http": "socks5://127.0.0.1:10808",
    "https": "socks5://127.0.0.1:10808",
}

try:
    r = requests.get("https://ipinfo.io/json", proxies=proxies, timeout=10)
    print(r.json())
except Exception as e:
    print("代理连接失败:", e)