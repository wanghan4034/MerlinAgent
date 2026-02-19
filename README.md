# Mercari JP 自动爬取 Agent

这是一个基于 **Playwright** 的 Mercari（日本煤炉）搜索结果抓取 agent。它会按关键词抓取列表页商品并输出为 JSONL。

## 功能
- 支持多个关键词轮询抓取。
- 支持分页（`--max-pages`）。
- 输出结构化字段（标题、价格、链接、卖家、是否售出、抓取时间）。
- 自动随机化 User-Agent，降低单一请求特征。

## 快速开始

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

运行示例：

```bash
python mercari_agent.py \
  --keywords "ポケモンカード" "ニンテンドースイッチ" \
  --max-pages 2 \
  --output output/mercari_items.jsonl
```

## 输出格式
每一行是一个 JSON 对象，例如：

```json
{"keyword":"ポケモンカード","title":"...","price_jpy":3200,"item_url":"https://jp.mercari.com/item/...","image_url":"...","seller_name":"...","is_sold":false,"scraped_at":"2026-02-19T03:00:00+00:00"}
```

## 参数说明
- `--keywords`: 必填，至少一个关键词。
- `--max-pages`: 每个关键词抓取页数，默认 1。
- `--wait-seconds`: 翻页等待间隔（会附加随机抖动），默认 1.5。
- `--output`: 输出 JSONL 路径，默认 `output/mercari_items.jsonl`。
- `--headful`: 显示浏览器界面运行（默认无头模式）。
- `--timeout-ms`: 页面超时，默认 30000。

## 合规提醒
请在使用前确认目标网站服务条款、robots 政策以及当地法律法规，合理控制请求频率，仅用于合法合规的数据采集场景。
