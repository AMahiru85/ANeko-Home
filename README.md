# ANeko - Home

ANeko - Home 是参考 zyyo 主页风格，基于 Astro、Vue 和 Cloudflare Workers 的个人站点，集成仪表盘、导航、博客、相册、网盘、邮箱和后台管理功能。

## 功能概览

| 页面 | 说明 |
| --- | --- |
| 首页 `/` | 显示时间、天气、GitHub 公开信息、站内功能入口和外部链接。 |
| 博客 `/blog/` | 支持文章列表、文章详情、标签、归档、分页和 RSS。文章正文使用 Markdown，可以关联附件。 |
| 相册 `/photos/` | 展示公开图片，支持查看大图和下载。 |
| 云盘 `/drive/` | 提供目录浏览、文件预览、下载和下载测速。 |
| 邮箱 `/mail/` | 通过已配置的 IMAP/SMTP 邮箱收取、阅读和发送邮件并管理邮箱设置。 |

## 技术组成

- **Astro 7、Vue 3、TypeScript**：页面、服务端路由和交互组件。
- **Cloudflare Workers**：SSR 页面和 API。
- **Cloudflare KV**：保存博客索引、相册清单和邮箱配置等结构化数据。
- **Cloudflare R2**：保存博客正文、附件、相册图片和云盘文件。
- **Cloudflare Turnstile**：Cloudflare 人机验证。
- **IndexNow**：向搜索引擎提交公开页面。

## 部署

### 部署前准备

1. 已启用 Workers、KV、R2 和 Turnstile 的 Cloudflare 账号。
2. 已接入 Cloudflare 的域名。
3. KV 空间，绑定名为 `ANEKO_KV`。
4. R2 存储桶，绑定名为 `ANEKO_R2`。
5. Turnstile Site Key 和 Secret Key。

### 配置 KV、R2 和站点资源

在 [wrangler.jsonc](wrangler.jsonc) 中填写实际的 KV 空间 ID 和 R2 存储桶 名称。绑定名必须保持不变：

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "ANEKO_KV",
      "id": "你的 KV 空间 ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "ANEKO_R2",
      "bucket_name": "你的 R2 存储桶 名称"
    }
  ]
}
```

`ANEKO_KV`、`ANEKO_R2` 和 `ASSETS` 是代码中的固定绑定名。可以修改资源名称，但不能修改这些绑定名。R2 不需要开启公共桶访问，通过 Worker 绑定访问对象。

###  部署

可使用 Cloudflare Workers 的 GitHub 集成进行自动部署。

1. 将项目推送到 GitHub 仓库，并确认需要部署的分支（默认使用 `main`）。
2. 在 Workers 设置中连接 Github 仓库。
3. 在构建设置：
   - 根目录：`/`
   - 部署命令：`npx wrangler deploy`
   - 构建命令：`pnpm run build`
5. 保存项目设置并开始首次部署。之后推送到生产分支时，Cloudflare 会自动构建并发布。

### 配置

部署完成后，站点内容和功能管理优先通过 `/admin` 完成。登录后台后，可以在同一个控制台切换首页内容、博客、相册、云盘和邮箱；首页内容会保存到 `ANEKO_KV`，不需要再直接修改多个 Vue 组件。

| 配置入口 | 修改内容 |
| --- | --- |
| `/admin` → 首页内容 | 修改欢迎语、显示名称、第一行、第二行、站点描述、GitHub 账号、所在地、学校 / 组织、标签、时间线、站内项目和外部链接。 |
| `/admin` → 博客 | 发布、编辑、删除文章，管理文章标签、附件和 Markdown 内容。 |
| `/admin` → 相册 | 上传、排序和删除相册图片。 |
| `/admin` → 云盘 | 创建文件夹、上传文件、移动或删除云盘内容。 |
| `/admin` → 邮箱 | 配置邮箱连接、收发邮件、管理文件夹和 Webhook。 |
| [src/layouts/SiteLayout.astro](src/layouts/SiteLayout.astro) | 修改站点默认标题、首页描述、关键词、作者和社交分享图片等 SEO 信息。 |
| [src/components/PageHeader.vue](src/components/PageHeader.vue)、[src/components/LeftSidebar.vue](src/components/LeftSidebar.vue)、[src/components/PageContent.vue](src/components/PageContent.vue) | 修改主页布局或开发者级默认值；正常内容编辑请使用 `/admin`。 |
| [src/components/PageFooter.vue](src/components/PageFooter.vue) | 修改页脚版权文字；年份会根据当前日期自动更新。 |
| `public/static/img/` 和 `public/static/svg/` | 替换主页使用的头像、背景、Logo、图标、二维码和技能图；替换后保持原文件名或修改组件中的路径。 |
| [src/pages/blog/about.astro](src/pages/blog/about.astro) | 修改博客介绍页上的 GitHub 外链，使其指向新的 GitHub 账号。 |
| [src/composables/useGitHub.js](src/composables/useGitHub.js) | 修改 GitHub 卡片的请求和展示逻辑；GitHub 账号请使用 `/admin` → 首页内容设置。 |
| [src/utils/runtime-config.ts](src/utils/runtime-config.ts) | 修改 `SITE_ORIGIN`，填写完整的 HTTPS 源地址，不带路径。 |
| [src/utils/turnstile-client.ts](src/utils/turnstile-client.ts) | 修改前端 `TURNSTILE_SITE_KEY`。 |
| [public/robots.txt](public/robots.txt) | 修改 Sitemap 地址。 |
| Cloudflare Turnstile 控制台 | 添加实际访问的域名。 |
| [wrangler.jsonc](wrangler.jsonc) | 配置 `ANEKO_KV`、`ANEKO_R2` 资源绑定，并启用 Worker 日志、调用日志和持久化追踪。 |
| `wrangler.jsonc` 的 `vars` | 设置 `TURNSTILE_HOSTNAMES`，多个主机名用英文逗号分隔。 |
| [src/composables/useWeather.js](src/composables/useWeather.js) | 修改主页天气数据接口 `WEATHER_API`（可选） |
| Cloudflare Worker 控制台 → **设置 →Runtime variables and secrets** | 添加加密 Secret `INDEXNOW_KEY`，填写 8–128 位字母、数字或短横线组成的密钥（可在https://www.bing.com/indexnow/getstarted#implementation 生成） |

### 邮箱 Webhook 请求格式

在 `/admin` → 邮箱中启用 Webhook，并为接口配置令牌、收件人和邮件模板。请求会按照所选模板生成邮件并发送。

**基本信息**

| 项目 | 说明 |
| --- | --- |
| Base URL | 部署后站点的 HTTPS 域名，例如 `https://example.com`。 |
| 默认接口 | `/api/mail/webhook` |
| 指定接口 | `/api/mail/webhook/{endpointId}` |
| 支持方法 | `GET`、`POST` |
| 成功响应 | `200 OK`，JSON |

`endpointId` 是后台接口标识，长度为 1–64 个字符，必须以字母或数字开头，其余字符可使用字母、数字、`.`、`_`、`-`。

**认证**

优先使用 `Authorization: Bearer <令牌>` 请求头。也可以通过 `token` 参数认证：GET 放在查询参数中，POST 放在 JSON 对象的 `token` 字段中。令牌在后台配置，长度为 32–256 个字符。

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `Authorization` | 请求头 | 字符串 | 否 | 格式为 `Bearer <令牌>`；与 `token` 二选一。 |
| `token` | GET 查询参数 / POST JSON | 字符串 | 否 | 令牌未放在请求头时必填；不会被写入模板数据。 |

**GET 参数**

```http
GET /api/mail/webhook/{endpointId}?token=<令牌>&event=order.created&orderId=1001 HTTP/1.1
Host: example.com
```

除 `token` 外，查询参数都是模板数据，值按字符串处理。GET 适用于只能发送简单查询参数的调用方；需要传嵌套对象时使用 POST。由于查询参数可能被代理或访问日志记录，调用方支持请求头时请通过 Bearer 头传令牌。

**POST 参数**

请求头：`Content-Type: application/json`。请求体必须是 JSON 对象，最大 2 MiB。除保留字段 `token` 外，字段均作为模板数据。

```http
POST /api/mail/webhook/alerts HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer <令牌>
Idempotency-Key: order-created-1001

{"event":"order.created","order":{"id":1001},"user":{"name":"Aki"}}
```

`Idempotency-Key` 为可选请求头，长度为 8–120 个字符，可包含字母、数字、`.`、`_`、`:`、`-`。相同 key 和相同邮件内容在 24 小时内不会重复发送；省略时每次请求都会生成新的 key。

**模板数据**

请求数据用于渲染该接口所关联的模板。字段可以通过路径引用，例如 `{{event}}`、`{{order.id}}`、`{{user.name}}`。`{{json}}` 会插入完整请求数据的 JSON（不包含 `token`）。GET 参数是扁平字符串；POST 可发送嵌套 JSON 对象。

**响应**

成功时返回：

```json
{
  "success": true,
  "data": {
    "sent": true,
    "idempotencyKey": "webhook:order-created-1001",
    "replayed": false
  }
}
```

重复提交相同幂等 key 和内容时，`replayed` 为 `true`。失败时返回 `{ "success": false, "error": "错误说明" }`。常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | JSON 格式无效、参数或幂等 key 无效。 |
| `401` | 令牌缺失或无效。 |
| `404` | 接口标识不存在。 |
| `409` | 幂等 key 冲突，或上次发送状态未知。 |
| `413` | POST 请求体超过 2 MiB。 |
| `429` | 发送频率超限；可参考 `Retry-After` 响应头。 |
| `503` | Webhook 已停用或邮件服务暂不可用。 |
| `500` | 未预期的服务端错误。 |

### 设置生产密钥

在 Cloudflare 控制台进入 **Workers & Pages → 目标 Worker → 设置 → Runtime variables and secrets**，添加加密 Secret：

- `ACCESS_CODE`：管理员访问码。
- `TURNSTILE_SECRET`：Turnstile 服务端密钥。
- `INDEXNOW_KEY`：IndexNow 密钥。

保存变量后重新部署 Worker。密钥不要写入 `wrangler.jsonc`、普通变量、README 或 Git 提交记录。

## 环境变量和密钥

生产配置分为普通变量、Secret 和资源绑定三类。Secret 只能通过 Cloudflare 的密钥配置功能设置；不要将其写入仓库或普通 `vars`。

### Secret

| 名称 | 用途 | 默认值 |
| --- | --- | --- |
| `ACCESS_CODE` | 管理员访问码。 | 无 |
| `TURNSTILE_SECRET` | Turnstile 服务端密钥，同时用于管理员会话签名。 | 无 |
| `INDEXNOW_KEY` | IndexNow 密钥，用于向 IndexNow 主接口和 Bing 提交页面。 | 无 |

`INDEXNOW_KEY` 必须是 8–128 位字母、数字或短横线，且与站点公开的 `/{INDEXNOW_KEY}.txt` 内容一致。

### 普通变量

| 名称 | 用途 | 默认值 |
| --- | --- | --- |
| `TURNSTILE_HOSTNAMES` | 允许 Turnstile 验证的主机名，多个值用英文逗号分隔。 | `www.aneko.ink` |
| `MAIL_ALLOWED_HOSTS` | 允许连接的 IMAP 和 SMTP 主机名。 | 不限制 |
| `BLOG_INDEX_KEY` | 博客索引在 KV 中使用的键名。 | `blog:index` |
| `PHOTO_MANIFEST_KEY` | 相册清单在 KV 中使用的键名。 | `photos` |
| `DRIVE_PREFIX` | 云盘文件在 R2 中使用的对象前缀。 | `drive/` |
| `MAIL_CONFIG_KV_KEY` | 邮箱配置在 KV 中使用的键名。 | `mail:config:v3` |

### 资源绑定

| 绑定名 | 类型 | 用途 |
| --- | --- | --- |
| `ANEKO_KV` | KV Namespace | 博客索引、相册清单和邮箱配置等数据。 |
| `ANEKO_R2` | R2 Bucket | 博客正文、附件、图片和云盘文件。 |
| `ASSETS` | Assets Fetcher | 网站构建后的静态资源。 |

## 目录结构

```text
.
├── src/
│   ├── components/       # Vue 交互组件，包括博客、相册、云盘和邮箱界面
│   ├── composables/      # Vue 组合式逻辑
│   ├── layouts/          # 网站和工作区布局
│   ├── pages/             # 页面和服务端 API 路由
│   │   ├── admin/        # 管理页面
│   │   ├── api/          # 认证、博客、相册、云盘和邮箱接口
│   │   ├── blog/         # 博客列表、文章、归档和标签页面
│   │   ├── drive/        # 云盘页面
│   │   ├── mail/         # 邮箱页面
│   │   └── photos/       # 相册页面
│   ├── plugins/          # Markdown 和博客内容插件
│   └── utils/            # 存储、认证、邮件和运行时配置
├── public/               # 图片、字体、图标、robots.txt 等静态资源
├── scripts/              # 测试和辅助脚本
├── tests/                # 博客、存储和 IndexNow 测试
├── astro.config.mjs      # Astro 配置
├── wrangler.jsonc        # Cloudflare Worker、KV 和 R2 配置
└── package.json          # 项目依赖和脚本
```

## 常见问题

### 管理员登录后仍返回 401

检查访问码、Turnstile Secret、站点域名和 HTTPS。更换 `TURNSTILE_SECRET` 后，原有管理员会话会失效，需要重新登录。

### 博客或相册返回 503

检查 Worker 是否绑定了正确的 `ANEKO_KV` 和 `ANEKO_R2`。KV 或 R2 暂时不可用时，页面会返回可重试的 503。

### 邮箱连接测试失败

确认邮箱服务商已启用 IMAP/SMTP，端口使用 IMAP TLS 993 和 SMTP TLS 465，并检查应用专用密码、主机白名单和服务商的连接限制。

### IndexNow 返回 429

429 表示搜索引擎接口限流。等待响应中的 Retry-After 时间后再试，也可以通过站外网络提交少量 URL。

## 项目源码

源码仓库：<https://github.com/AMahiru85/ANeko-Home>

## License

[MIT](LICENSE)
