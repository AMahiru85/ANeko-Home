# ANeko - Home

参考 zyyo 主页风格，基于 Astro、Vue 和 Cloudflare Workers 的个人站点。

## 页面与路由

| 页面 | 路由 | 功能 |
| --- | --- | --- |
| 首页 | `/` | 时间、天气、GitHub 公开信息、站内项目和外部链接。 |
| 管理后台 | `/admin/` | 管理首页内容、博客、相册、云盘和邮箱。 |
| 博客管理 | `/admin/blog/` | 发布和编辑博客文章。 |
| 博客列表 | `/blog/` | 文章列表和分页入口。 |
| 博客文章 | `/blog/{slug}/` | Markdown 文章正文及附件。 |
| 博客分页 | `/blog/page/{page}/` | 浏览指定页的文章列表。 |
| 博客标签 | `/blog/tag/{tag}/` | 按标签查看文章。 |
| 博客归档 | `/blog/archive/` | 按时间查看文章。 |
| 博客介绍 | `/blog/about/` | 博客说明和相关链接。 |
| 相册 | `/photos/` | 浏览公开图片、查看大图和下载。 |
| 云盘 | `/drive/` | 浏览文件、预览、下载和测速。 |
| 邮箱 | `/mail/` | 使用已配置的 IMAP/SMTP 邮箱收发邮件。 |
| RSS | `/rss.xml` | 博客订阅源。 |
| Sitemap | `/sitemap.xml` | 站点公开页面索引。 |
| 搜索 | `GET /api/search.json` | 搜索博客内容。 |

## 运行架构

| 服务 | 用途 |
| --- | --- |
| Cloudflare Workers | SSR 页面和 API |
| Cloudflare KV | 保存站点内容、博客索引、相册清单、邮箱和 Webhook 配置等数据 |
| Cloudflare R2 | 保存博客正文与附件、相册图片和云盘文件 |
| Cloudflare Turnstile | Cloudflare 人机验证 |
| IndexNow | 搜索引擎提交信息 |

## 部署

### 部署条件

| 项目 | 要求 |
| --- | --- |
| KV Namespace | 创建一个 KV Namespace，并绑定为 `ANEKO_KV` |
| R2 Bucket | 创建一个 R2 Bucket，并绑定为 `ANEKO_R2` |
| Turnstile | 创建 Site Key 和 Secret Key |

### 配置 Cloudflare 资源

在 `wrangler.jsonc` 中为自己的 Cloudflare 账号填写 KV ID 和 R2 存储桶名称。保留绑定名 `ANEKO_KV`、`ANEKO_R2`、`ASSETS`；R2 无需开启公共访问。

| 绑定名 | 类型 | 用途 |
| --- | --- | --- |
| `ANEKO_KV` | KV Namespace | 站点内容、博客索引、相册清单、邮箱配置 |
| `ANEKO_R2` | R2 Bucket | 博客正文和附件、相册图片、云盘文件 |
| `ASSETS` | Assets Fetcher | Worker 读取构建后的静态资源 |

### 部署

Cloudflare Workers 的 Git 集成使用以下构建设置：

| 设置 | 值 |
| --- | --- |
| 根目录 | `/` |
| 安装命令 | `pnpm install --frozen-lockfile` |
| 构建命令 | `pnpm run build` |
| 部署命令 | `pnpm exec wrangler deploy --config dist/server/wrangler.json` |

将集成配置连接到目标仓库和生产分支后，推送到该分支即可触发构建和部署。

## 运行配置

### 管理后台配置

| 入口 | 可管理内容 |
| --- | --- |
| `/admin/` → 首页内容 | 编辑站点内容 |
| `/admin/` → 博客 | 创建、编辑和删除文章，管理标签、附件与 Markdown 正文 |
| `/admin/` → 相册 | 上传、排序和删除相册图片 |
| `/admin/` → 云盘 | 创建目录、上传文件、移动和删除文件 |
| `/admin/` → 邮箱 | 配置邮箱连接、收发邮件、管理文件夹和 Webhook |
| `/admin/blog/` | 独立博客管理页面 |

### Worker 加密变量

在 Cloudflare 控制台进入目标 Worker 的 **设置 → 变量和密钥**，添加加密变量。

| 名称 | 必需性 | 用途与格式 |
| --- | --- | --- |
| `ACCESS_CODE` | 必需 | 管理员访问码 |
| `TURNSTILE_SECRET` | 必需 | Turnstile 服务端密钥，并用于管理员会话签名 |
| `INDEXNOW_KEY` | 可选 | IndexNow 密钥，8–128 位字母、数字或短横线；必须与 `/{INDEXNOW_KEY}.txt` 的公开内容一致 |

### Worker 普通变量

| 名称 | 默认值 | 用途 |
| --- | --- | --- |
| `TURNSTILE_HOSTNAMES` | `www.aneko.ink` | 允许通过 Turnstile 验证的主机名；多个值用英文逗号分隔。 |
| `MAIL_ALLOWED_HOSTS` | 不限制 | 允许连接的 IMAP/SMTP 主机名。生产环境建议配置允许列表。 |
| `BLOG_INDEX_KEY` | `blog:index` | 博客索引使用的 KV 键名。 |
| `PHOTO_MANIFEST_KEY` | `photos` | 相册清单使用的 KV 键名。 |
| `DRIVE_PREFIX` | `drive/` | 云盘文件在 R2 中使用的对象前缀。 |
| `MAIL_CONFIG_KV_KEY` | `mail:config:v3` | 邮箱配置使用的 KV 键名。 |

### 源码站点设置

| 设置 | 文件 | 用途 |
| --- | --- | --- |
| `SITE_ORIGIN` | `src/utils/runtime-config.ts` | 站点 HTTPS 源地址；用于规范 URL、RSS 和 Sitemap。自定义域名时修改此值 |
| `TURNSTILE_SITE_KEY` | `src/utils/turnstile-client.ts` | Turnstile 前端 Site Key。它是公开标识，不是 Secret |
| SEO 默认值 | `src/layouts/SiteLayout.astro` | 修改默认标题、描述、关键词、作者和分享图片 |
| 主页布局 | `src/components/PageHeader.vue`、`src/components/LeftSidebar.vue`、`src/components/PageContent.vue` | 修改主页结构与展示组件 |
| 页脚 | `src/components/PageFooter.vue` | 修改版权文字 |
| 图片与图标 | `public/static/img/`、`public/static/svg/` | 替换站点图片、背景、Logo 和图标 |
| 博客介绍链接 | `src/pages/blog/about.astro` | 修改博客介绍页中的 GitHub 链接 |
| GitHub 卡片 | `src/composables/useGitHub.js` | 修改 GitHub 信息获取或展示逻辑 |
| Sitemap 声明 | `public/robots.txt` | 修改公开 Sitemap 地址 |
| 天气数据源 | `src/composables/useWeather.js` | 修改可选的天气 API 地址 |

站点可编辑内容应通过管理后台维护；只有布局、源码默认值和运行环境设置需要修改代码或 Cloudflare 配置。

## API 参考

### 邮箱 Webhook

在 `/admin/` → 邮箱中启用 Webhook，并为每个接口配置令牌、收件人和邮件模板。请求通过所选模板生成并发送邮件。

#### 基本信息

| 项目 | 说明 |
| --- | --- |
| Base URL | 部署站点的 HTTPS 源地址，例如 `https://example.com`。 |
| 默认接口 | `/api/mail/webhook` |
| 指定接口 | `/api/mail/webhook/{endpointId}` |
| 支持方法 | `GET`、`POST` |
| 成功状态 | `200 OK` |
| 响应类型 | `application/json` |

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/mail/webhook` | 调用默认接口，数据放在查询参数中 |
| `POST` | `/api/mail/webhook` | 调用默认接口，数据放在 JSON 请求体中 |
| `GET` | `/api/mail/webhook/{endpointId}` | 调用指定接口，数据放在查询参数中 |
| `POST` | `/api/mail/webhook/{endpointId}` | 调用指定接口，数据放在 JSON 请求体中 |

`endpointId` 必须与后台配置的接口标识一致，长度为 1–64 个字符；首字符为字母或数字，其余字符可使用字母、数字、`.`、`_`、`-`。

#### 认证

认证令牌在管理后台的 Webhook 接口设置中配置。可以使用 Bearer 请求头，或使用请求参数 `token`。如果两种方式都提供，任意一种有效令牌即可通过验证。

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `Authorization` | 请求头 | 字符串 | 否 | 格式为 `Bearer <令牌>` |
| `token` | GET 查询参数 / POST JSON | 字符串 | 否 | 未使用有效 Bearer 令牌时必填；不会传入模板 |

令牌长度为 32–256 个字符。GET 的令牌位于 URL 中，可能被代理或访问日志记录；调用方支持自定义请求头时，建议通过 Bearer 请求头发送。

#### GET 参数

GET 将请求参数放在 URL 查询字符串中。除保留字段 `token` 外，所有字段都会作为模板数据传入，值均按字符串处理。查询参数为扁平结构；需要传递嵌套对象时使用 POST。

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `token` | 查询参数 | 字符串 | 条件必填 | Webhook 令牌；可由 Bearer 请求头替代 |
| 自定义字段 | 查询参数 | 字符串 | 否 | 用于渲染邮件主题和正文模板 |

~~~http
GET /api/mail/webhook/alerts?token=<令牌>&event=server.down&host=node-1 HTTP/1.1
Host: example.com
~~~

#### POST 参数

POST 的 `Content-Type` 必须为 `application/json`。请求体必须是 JSON 对象，最大 2 MiB。除保留字段 `token` 外，对象中的字段都会作为模板数据传入。

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `token` | JSON 字段 | 字符串 | 条件必填 | Webhook 令牌；可由 Bearer 请求头替代 |
| 自定义字段 | JSON 字段 | 任意 JSON 值 | 否 | 用于渲染邮件模板；支持嵌套对象 |

~~~http
POST /api/mail/webhook/alerts HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer <令牌>
Idempotency-Key: order-created-1001

{"event":"order.created","order":{"id":1001},"user":{"name":"Aki"}}
~~~

#### 模板数据

模板使用双花括号引用请求数据中的字段，例如 `{{event}}`、`{{order.id}}`、`{{user.name}}`。特殊占位符 `{{json}}` 会插入完整请求数据的 JSON 字符串；令牌字段不会包含在模板数据中。

#### 幂等请求

`Idempotency-Key` 是可选请求头，长度为 8–120 个字符；首字符必须为字母或数字，其余字符可包含字母、数字、`.`、`_`、`:`、`-`。相同 key 与相同邮件内容在 24 小时内不会重复发送。省略该请求头时，每次调用都会生成新的 key。

#### 响应

成功时返回 HTTP `200`：

~~~json
{
  "success": true,
  "data": {
    "sent": true,
    "idempotencyKey": "webhook:order-created-1001",
    "replayed": false
  }
}
~~~

以相同幂等 key 和邮件内容重试时，`replayed` 为 `true`。错误响应使用以下结构：

~~~json
{
  "success": false,
  "error": "错误说明"
}
~~~

| 状态码 | 含义 |
| --- | --- |
| `400` | 请求 JSON、模板数据或幂等 key 无效。 |
| `401` | 令牌缺失或无效；响应包含 `WWW-Authenticate: Bearer`。 |
| `404` | Webhook 接口标识不存在。 |
| `409` | 幂等 key 与已有请求内容冲突，或邮件发送状态未知。 |
| `413` | POST 请求体超过 2 MiB。 |
| `429` | 发送频率超限；响应可能包含 `Retry-After`。 |
| `503` | Webhook 已停用，或邮件服务暂不可用。 |
| `500` | 未预期的服务端错误。 |

## 项目结构

~~~text
.
├── src/
│   ├── components/       # Vue 页面与交互组件
│   ├── composables/      # Vue 组合式逻辑
│   ├── layouts/          # 页面布局与 SEO 默认值
│   ├── pages/            # 页面和服务端 API 路由
│   ├── plugins/          # Markdown 与博客内容插件
│   └── utils/            # 存储、认证、邮件和运行时配置
├── public/               # 静态图片、字体、图标和 robots.txt
├── scripts/              # 辅助脚本
├── tests/                # 自动化测试
├── astro.config.mjs      # Astro 与 Cloudflare adapter 配置
├── wrangler.jsonc        # Worker、资源绑定与可观测性配置
└── package.json          # 依赖与开发命令
~~~

## 故障排查

| 症状 | 检查项 |
| --- | --- |
| 管理员登录返回 `401` 或验证失败 | 检查 `ACCESS_CODE`、`TURNSTILE_SECRET`、`TURNSTILE_HOSTNAMES` 和实际访问域名；更换 `TURNSTILE_SECRET` 后需要重新登录。 |
| 博客或相册返回 `503` | 检查 Worker 是否绑定正确的 `ANEKO_KV` 和 `ANEKO_R2`，并确认资源可用。 |
| 邮箱连接测试失败 | 确认邮箱服务已启用 IMAP/SMTP，账号和应用专用密码正确；IMAP 使用 TLS 993，SMTP 使用 TLS 465，并检查 `MAIL_ALLOWED_HOSTS`。 |
| IndexNow 返回 `429` | 上游服务已限流；等待 `Retry-After` 时间后重试。（cloudflare cdn 节点IP应该是被拉黑了，提交都会返回429） |
| IndexNow 密钥验证失败 | 确认 Worker Secret `INDEXNOW_KEY` 与可公开访问的 `/{INDEXNOW_KEY}.txt` 内容完全一致。 |

## 源码与许可

| 项目 | 地址 |
| --- | --- |
| 源码仓库 | <https://github.com/AMahiru85/ANeko-Home> |
| 许可证 | [MIT](LICENSE) |
