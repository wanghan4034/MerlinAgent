# Mercari JP 自动爬取 Agent（增强版）

这是一个基于 **Playwright + SQLite** 的 Mercari（日本煤炉）抓取 Agent，支持：
- 定时任务（cron / systemd timer）
- 去重与增量抓取（SQLite）
- Telegram / 飞书实时通知

## 功能
- 多关键词与分页抓取。
- 列表页结构化解析（标题、价格、链接、卖家、SOLD 状态）。
- JSONL 全量落盘（便于追溯）+ SQLite 增量去重（便于业务消费）。
- 实时通知：默认仅通知“新上架”项目，可切换为通知全部抓取项。

## 安装

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```


## Docker 部署（推荐）

已封装为 Docker 应用，包含运行所需环境（Python + Playwright + 浏览器依赖）。

### 1) 构建并启动

```bash
docker compose up -d --build
```

启动后访问：`http://127.0.0.1:8000`

> 若你希望使用 `.env` 文件管理代理/通知变量，请先执行：`cp .env.example .env`。
> 不创建 `.env` 也可以启动容器（仅不会自动注入这些变量）。

### 2) 数据持久化

`docker-compose.yml` 已默认挂载：
- `./data -> /app/data`（SQLite 数据库、模板配置）
- `./output -> /app/output`（JSONL 导出）
- `./logs -> /app/logs`（运行日志）

### 3) 查看日志

```bash
docker compose logs -f mercari-agent-web
```

### 4) 停止应用

```bash
docker compose down
```



### 5) 容器内自动定时抓取（默认每 15 分钟）

现在容器启动后会自动执行“定时新增抓取”（无需你再手动配置宿主机 cron/systemd）。

定时配置文件：`config/scheduler.json`

```json
{
  "enabled": true,
  "interval_minutes": 15,
  "keywords": ["ポケモンカード", "ニンテンドースイッチ"],
  "max_pages": 1,
  "wait_seconds": 1.5,
  "timeout_ms": 30000,
  "output_path": "output/mercari_items.jsonl",
  "db_path": "data/mercari_items.db",
  "notify_all": false
}
```

你只需修改 `interval_minutes` 即可调整抓取频率（例如改成 `5` 表示每 5 分钟）。


### 6) 容器内代理自检（check_proxy.py）

如果你想在容器里快速验证 ShadowsocksX 代理是否可用：

```bash
python3 tests/check_proxy.py
```

可选环境变量：
- `PROXY_SERVER`（默认 `socks5://host.docker.internal:10808`）
- `PROXY_CHECK_URL`（默认 `https://jp.mercari.com`）
- `PROXY_CHECK_TIMEOUT`（默认 `20` 秒）

若看到 `Missing dependencies for SOCKS support`，说明镜像内缺少 SOCKS 依赖。当前仓库已补充 `requests[socks]` + `PySocks`，重新构建镜像即可：

```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d
```

## 中国网络下访问 Mercari（ShadowsocksX 配置）

你提到使用 **ShadowsocksX**（macOS）。该场景下通常只需配置 SOCKS5 出口即可。

请在仓库根目录创建 `.env`（可由 `.env.example` 复制）并提供：

### 必填
- `PROXY_SERVER`：代理地址，格式 `socks5://<host>:<port>`。

### 选填（一般本地 ShadowsocksX 不需要）
- `PROXY_USERNAME`
- `PROXY_PASSWORD`

### 结合你当前 ShadowsocksX 配置（截图）
你当前本地 SOCKS5 监听为：`127.0.0.1:10808`。

- **CLI 直接在 macOS 上运行时**：
  - `PROXY_SERVER=socks5://127.0.0.1:10808`
- **Docker 容器内运行时**（推荐）：
  - `PROXY_SERVER=socks5://host.docker.internal:10808`

```env
# Docker 推荐
PROXY_SERVER=socks5://host.docker.internal:10808
PROXY_USERNAME=
PROXY_PASSWORD=
```

> 若连接失败，请检查 ShadowsocksX 是否已启动、端口是否为 `10808`，以及代理模式是否允许本机应用通过该 SOCKS5 端口访问。

在 Web 页面中也可直接填写“代理地址/用户名/密码”；为空时后端会自动读取 `.env` 中的 `PROXY_*` 变量。

## 运行示例

### 1) 基础抓取（增量 + 去重）

```bash
python mercari_agent.py \
  --keywords "ポケモンカード" "ニンテンドースイッチ" \
  --max-pages 2 \
  --output output/mercari_items.jsonl \
  --db-path data/mercari_items.db
```

### 2) Telegram 实时通知（默认只通知新商品）

```bash
python mercari_agent.py \
  --keywords "遊戯王" \
  --telegram-bot-token "<BOT_TOKEN>" \
  --telegram-chat-id "<CHAT_ID>"
```

### 3) 飞书实时通知

```bash
python mercari_agent.py \
  --keywords "任天堂" \
  --feishu-webhook "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
```

### 4) 通知全部抓取项目（不只新项目）

```bash
python mercari_agent.py --keywords "ポケカ" --notify-all
```

## 参数说明
- `--keywords`: 必填，至少一个关键词。
- `--max-pages`: 每关键词抓取页数，默认 `1`。
- `--wait-seconds`: 翻页等待基础间隔（会附加随机抖动），默认 `1.5`。
- `--output`: JSONL 输出路径，默认 `output/mercari_items.jsonl`。
- `--db-path`: SQLite 数据库路径，默认 `data/mercari_items.db`。
- `--headful`: 有头模式运行浏览器。
- `--timeout-ms`: 页面等待超时（毫秒），默认 `30000`。
- `--telegram-bot-token` / `--telegram-chat-id`: Telegram 通知配置。
- `--feishu-webhook`: 飞书机器人 Webhook。
- `--notify-all`: 开启后通知所有抓取结果（默认仅通知新增）。

## SQLite 去重逻辑
- 以 `item_url` 作为唯一键。
- 首次出现：写入 `first_seen_at`。
- 后续重复出现：更新 `last_seen_at` 并 `occurrence_count + 1`。



## 网页版可视化控制台（给非技术用户）

启动 Web 页面：

```bash
python3 web_app.py
```

然后在浏览器打开：`http://127.0.0.1:8000`

页面能力：
- 图形化配置抓取参数（关键词、页数、间隔、超时、输出路径、数据库路径）。
- 一键启动抓取任务，并实时查看任务状态（queued/running/completed/failed）。
- 任务中心：显示最近任务列表，快速判断任务成功率。
- 数据面板展示总商品数、关键词数、已售数量、平均价格、最近更新时间。
- 商品列表支持多条件筛选（关键词、标题关键字、价格区间、是否已售）。
- 支持 Telegram / 飞书通知参数直接在页面填写。
- 支持“配置模板”保存/加载/删除，方便不会写代码的用户重复执行相同策略。


## Web API（可二次开发）
- `GET /api/health`: 服务健康检查。
- `POST /api/run`: 提交抓取任务。
- `GET /api/job/<job_id>`: 查询单任务状态。
- `GET /api/jobs`: 查询最近任务列表。
- `GET /api/stats`: 查询聚合统计。
- `GET /api/items`: 查询商品（支持 `q/keyword/min_price/max_price/sold_only`）。
- `GET/POST/DELETE /api/profiles`: 配置模板管理。

## 测试

运行单元测试：

```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

## 定时任务

### Cron

每 15 分钟抓取一次：

```cron
*/15 * * * * cd /workspace/MerlinAgent && /usr/bin/python3 mercari_agent.py --keywords "ポケモンカード" --max-pages 2 --db-path data/mercari_items.db --output output/mercari_items.jsonl >> logs/cron.log 2>&1
```

> 建议先 `mkdir -p logs output data`。

### systemd timer

仓库提供了示例：
- `deploy/systemd/mercari-agent.service`
- `deploy/systemd/mercari-agent.timer`

安装（Linux）：

```bash
sudo cp deploy/systemd/mercari-agent.service /etc/systemd/system/
sudo cp deploy/systemd/mercari-agent.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mercari-agent.timer
sudo systemctl status mercari-agent.timer
```

## 合规提醒
请在使用前确认目标网站服务条款、robots 政策以及当地法律法规，合理控制请求频率，仅用于合法合规的数据采集。
