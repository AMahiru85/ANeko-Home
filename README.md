# ANeko - Home

ANeko - Home 是参考 zyyo 主页风格，基于 Astro、Vue 和 Cloudflare Workers 构建的个人站点，集成仪表盘、导航、博客、相册、网盘、邮箱和后台管理功能。

## 目录

- [技术栈与存储](#技术栈与存储)
- [部署前准备](#部署前准备)
- [本地开发](#本地开发)
- [部署到 Cloudflare Workers](#部署到-cloudflare-workers)
- [环境变量说明](#环境变量说明)
- [首次使用与数据初始化](#首次使用与数据初始化)
- [更新与备份](#更新与备份)
- [常见问题](#常见问题)
- [常用命令](#常用命令)
- [目录结构](#目录结构)

## 技术栈与存储

- **Astro 7 + Vue 3**：页面、服务端 API 和交互组件。
- **TypeScript**：启用 Astro 严格类型配置。
- **Cloudflare Workers**：运行服务端代码。
- **Cloudflare KV**：保存博客索引、文章元数据、相册清单和邮件配置等。
- **Cloudflare R2**：保存博客正文、博客附件、相册图片和网盘文件。
- **Cloudflare Turnstile**：管理登录的人机验证。
- **IMAP / SMTP**：连接已有邮箱。
- **IndexNow**：文章发布、更新、撤回或删除后异步通知支持该协议的搜索引擎。

依赖版本与脚本以 [package.json](<package.json>) 为准；运行模式见 [astro.config.mjs](<astro.config.mjs>)。

## 部署前准备

1. 安装受当前 Astro / Wrangler 支持的 Node.js，并安装 pnpm。
2. 准备 Cloudflare 账号，确保可以使用 Workers、KV、R2 和 Turnstile。
3. 准备生产访问域名，该域名要加入 Turnstile 配置。
4. 如需邮箱功能，准备支持 **IMAP TLS 993 / SMTP TLS 465** 的邮箱及密码。
5. 获取项目代码，在项目根目录执行：

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```


## 本地开发

### 1. 创建本地变量文件

将 [.dev.vars.example](<.dev.vars.example>) 复制为项目根目录下的 `.dev.vars`：

```powershell
# Windows PowerShell
Copy-Item .dev.vars.example .dev.vars
```

```sh
# macOS / Linux
cp .dev.vars.example .dev.vars
```

填写本地访问码和 Turnstile Secret。示例中的 `replace-with-...` 都是占位符，不能直接用于实际验证。

本地允许的 Turnstile 主机名示例已设置为 `localhost,127.0.0.1`。仍需让前端 Site Key、后端 Secret 和 Turnstile 控制台的允许域名相匹配，配置方式见下文。

### 2. 启动开发环境

```sh
pnpm dev
```

以终端输出的本地地址为准。Cloudflare 适配器已启用本地状态持久化；默认本地模拟的 KV/R2 数据与线上数据独立，不会因部署自动同步。

> 管理会话使用带 `Secure` 属性的 `__Host-` Cookie。如果普通 HTTP 本地环境中出现“登录后仍未登录”，请检查浏览器是否接受 Cookie，并使用受信任的本地 HTTPS 环境或线上 HTTPS 地址验证。不要通过移除安全属性解决生产登录问题。

### 3. 检查与构建

```sh
pnpm check
pnpm build
```

`check` 执行 Astro 检查和 TypeScript 检查，`build` 生成 Worker 与静态资源。构建通过不代表线上绑定、Turnstile 或邮件连接已验证，部署后仍需进行功能检查。

## 部署到 Cloudflare Workers

### 创建 KV 和 R2

下面的资源名称可自行修改：

```sh
pnpm exec wrangler kv namespace create ANEKO_KV
pnpm exec wrangler r2 bucket create aneko-home-storage
```

也可以在 Cloudflare 控制台创建。记录 KV Namespace ID 和实际 R2 Bucket 名称；若复用已有资源，则不必重复创建。

编辑 [wrangler.jsonc](<wrangler.jsonc>)，保留原有兼容性与静态资源配置，将资源绑定补全为实际值。例如：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "aneko-home",
  "compatibility_date": "2026-07-17",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist"
  },
  "kv_namespaces": [
    {
      "binding": "ANEKO_KV",
      "id": "替换为实际的 KV Namespace ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "ANEKO_R2",
      "bucket_name": "aneko-home-storage"
    }
  ],
  "vars": {
    "TURNSTILE_HOSTNAMES": "home.example.com"
  }
}
```

- `name` 是 Worker 名称。部署后不要随意更改，否则可能部署成另一个 Worker。
- **绑定名 `ANEKO_KV`、`ANEKO_R2`、`ASSETS` 必须与代码一致**；资源名称可以自定义。
- 示例采用显式绑定，方便确认资源归属和后续更新时的数据位置。
- R2 不需要开启公共桶访问，应用通过 Worker 绑定读取文件。
- 保留项目兼容性日期与 `nodejs_compat`；若部署环境不支持该日期，先确认本地 Wrangler 和 Cloudflare 支持情况，不要盲目修改日期。

### 3. 配置站点域名和 Turnstile

在 Cloudflare Turnstile 控制台创建自己的站点，添加实际访问主机名，取得配套的 **Site Key** 与 **Secret Key**。

| 配置位置 | 要修改的内容 |
| --- | --- |
| [runtime-config.ts](<src/utils/runtime-config.ts>) | 将 `SITE_ORIGIN` 改为站点完整 HTTPS 源地址，例如 `https://home.example.com`，不带路径或末尾斜杠 |
| [turnstile-client.ts](<src/utils/turnstile-client.ts>) | 将 `TURNSTILE_SITE_KEY` 替换为自己的公开 Site Key |
| [robots.txt](<public/robots.txt>) | 将 `Sitemap` 地址改为自己的域名下的 `/sitemap.xml` |
| [wrangler.jsonc](<wrangler.jsonc>) 的 `vars` | 设置 `TURNSTILE_HOSTNAMES`，多个主机名用英文逗号分隔，不包含协议、端口或路径 |
| Cloudflare Turnstile 控制台 | 添加实际访问域名；本地调试时另行添加本地主机名或使用独立开发站点 |

**Site Key 是公开值，Secret Key 必须作为密钥保存。** 当前代码没有从环境变量读取前端 Site Key，仅设置一个同名 Worker 变量不会替换它。

服务端还会校验 Turnstile 的 `action` 和返回的 `hostname`。不要只修改前端 Site Key 而遗漏后端 Secret 或域名配置。使用官方测试密钥时，也要考虑本项目额外的主机名校验，不应假设测试密钥可以直接通过完整登录流程。

### 4. 上传生产密钥

先确定 Worker 名称，再执行以下命令，并在交互提示中输入值：

```sh
pnpm exec wrangler secret put ACCESS_CODE --config wrangler.jsonc
pnpm exec wrangler secret put TURNSTILE_SECRET --config wrangler.jsonc
pnpm exec wrangler secret put INDEXNOW_KEY --config wrangler.jsonc
```

首次执行时，若 Wrangler 提示目标 Worker 不存在，可按提示创建同名 Worker，再继续上传密钥。若当前工具版本不提供此流程，可先执行下一步的首次部署，再立即补齐密钥；密钥配置完成前不要开放站点使用。

> `.dev.vars` 只用于本地开发，**不会自动上传为生产密钥**。不要用普通 `vars` 存储 `ACCESS_CODE` 或 `TURNSTILE_SECRET`。

### 5. 构建并部署

```sh
pnpm check
pnpm run deploy
```

使用 `pnpm run deploy` 显式执行项目脚本，避免与 pnpm 自带的 `deploy` 命令混淆。实际脚本为：

```sh
astro build && wrangler deploy --config dist/server/wrangler.json
```

它使用 Astro Cloudflare 适配器生成的配置来部署 Worker 和静态资源。**不要将裸 `wrangler deploy` 当作等价替代，也不要手工维护生成配置**；修改根配置后重新执行构建部署。

### 6. 绑定域名并验收

在 Cloudflare 控制台进入目标 Worker 的 **Settings → Domains & Routes**，按控制台指引添加 Custom Domain，确认 DNS、证书和 HTTPS 正常。若先使用 `workers.dev` 验证，也需将其加入 Turnstile 两处允许域名配置。

部署后逐项检查：

- [ ] 首页、博客、相册、网盘和邮箱页面能正常打开。
- [ ] `/sitemap.xml` 和 `/robots.txt` 中的域名正确。
- [ ] 访问运行时配置对应的 `/{INDEXNOW_KEY}.txt`，确认返回 key 本身；在博客管理页执行一次“提交收录”。
- [ ] `/admin/blog/` 可以完成 Turnstile 验证与访问码登录。
- [ ] 能创建测试文章、上传图片并在前台查看，验证 KV/R2 写入与读取。
- [ ] 网盘能上传、列出并下载一个无敏感信息的测试文件。
- [ ] 如启用邮箱，完成连接测试和一封测试邮件的收发。
- [ ] 退出登录后无法继续执行管理写操作。

可通过 Cloudflare 控制台日志排查运行时问题，或使用：

```sh
pnpm exec wrangler tail --config wrangler.jsonc
```

日志排查时注意遮蔽访问码、Cookie、邮箱凭据和 Webhook Token。

## 环境变量说明

变量类型见 [env.d.ts](<src/env.d.ts>)；默认值见 [runtime-config.ts](<src/utils/runtime-config.ts>)。

| 名称 | 配置方式 | 用途与默认值 |
| --- | --- | --- |
| `ACCESS_CODE` | Secret；管理功能必需 | 管理访问码，使用高强度随机值；无默认值 |
| `TURNSTILE_SECRET` | Secret；管理功能必需 | 与前端 Site Key 配套的 Turnstile Secret，同时用于当前管理会话签名；无默认值 |
| `TURNSTILE_HOSTNAMES` | 普通变量；建议显式设置 | 允许的验证主机名，英文逗号分隔；默认取 `SITE_ORIGIN` 的主机名 |
| `MAIL_ALLOWED_HOSTS` | 普通变量；可选 | 允许连接的邮件服务器主机名，建议填写实际 IMAP/SMTP 主机；未设置时不应用这层白名单，但仍有主机格式等校验 |
| `BLOG_INDEX_KEY` | 普通变量；可选 | 博客索引的 KV Key，默认 `blog:index` |
| `PHOTO_MANIFEST_KEY` | 普通变量；可选 | 相册清单的 KV Key，默认 `photos` |
| `DRIVE_PREFIX` | 普通变量；可选 | 网盘 R2 对象前缀，默认 `drive/` |
| `MAIL_CONFIG_KV_KEY` | 普通变量；可选 | 邮件配置的 KV Key，默认 `mail:config:v3` |
| `INDEXNOW_KEY` | Secret；启用 IndexNow 时必需 | 8 至 128 位随机字母、数字或连字符；无默认值，不要提交、记录或分享 |

普通生产变量建议统一维护在 [wrangler.jsonc](<wrangler.jsonc>) 的 `vars` 中，避免控制台配置与下次代码部署不一致。本地则写入 `.dev.vars`。

## 首次使用与数据初始化

### 博客

新 KV/R2 没有内容时，博客列表为空是正常情况。通过 `/admin/blog/` 登录后创建内容，无需预先导入 SQL 或手工生成文章索引。

公开文章保存或删除成功后会自动向 IndexNow 提交受影响的文章、列表、归档、标签和分页 URL。管理页中的“提交收录”按钮可批量提交当前所有公开页面。服务端会通过站点根目录下不可猜测的同名 `.txt` 路由向搜索引擎验证 key；不要把 key 或完整验证地址写入仓库、日志和公开文档。

博客索引和文章元数据位于 KV，正文位于 R2 的 `blog/posts/`，附件位于 `blog/assets/`。迁移时必须同时迁移 KV 和 R2，不能只复制其中一项。

### 网盘

默认使用 R2 的 `drive/` 前缀，首次使用可直接通过界面上传文件。

> **当前网盘列表和下载接口允许公开读取，管理认证主要保护写操作。相册图片也可公开访问。请勿把网盘当作私密存储或上传敏感文件。** 私有 R2 桶并不意味着经 Worker 暴露的文件是私有的。

### 相册

相册读取 KV 中的 `photos` 清单（或 `PHOTO_MANIFEST_KEY` 指定的 Key）。需要手工初始化时，可在 R2 上传图片，并在 KV 写入 JSON 文本，例如：

```json
[
  {
    "title": "旅行记录",
    "date": "2026-01-01",
    "description": "示例相册",
    "images": [
      { "img": "travel/example.jpg" }
    ]
  }
]
```

对应的 R2 对象 Key 必须是 `photos/travel/example.jpg`。清单中的 `img` 是相对于 `photos/` 的路径，**不要加 `photos/` 前缀，也不要填完整 URL**。公开访问路径为 `/api/photos/image/travel/example.jpg`。

图片响应采用长期缓存，替换图片时建议使用新对象路径并更新清单，避免浏览器继续显示旧内容。

### 邮箱

访问 `/mail/`，登录并在邮箱设置中填写邮箱地址、IMAP/SMTP 服务器和凭据，保存后进行连接测试。

- 当前配置支持 IMAP TLS **993** 和 SMTP TLS **465**；不要填 SMTP 587/STARTTLS 配置。
- 邮箱服务商可能要求启用 IMAP/SMTP 并使用应用专用密码，而不是网页登录密码。
- 若设置 `MAIL_ALLOWED_HOSTS`，必须同时包含实际使用的 IMAP 和 SMTP 主机名。
- 邮件服务商还需允许来自 Cloudflare Workers 的连接；认证成功但连接失败时，应检查服务商限制。
- 邮件配置和 Webhook Token 以明文 JSON 存储在 KV；必须严格限制 Cloudflare 账户和 KV Namespace 的访问权限。
- Webhook Token 属于敏感凭据，配置后应妥善保存，避免出现在公开页面和仓库中。

## 更新与备份

更新源码后，执行：

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm run deploy
```

- 根配置、域名常量和前端 Site Key 的修改都需要重新构建部署。
- 正常部署代码不会自动迁移数据。不要随意改变 KV Namespace、R2 Bucket、索引 Key 或对象前缀，否则原数据可能不再可见。
- 上线前和重要变更前备份 **KV 数据 + R2 对象**，并将备份作为敏感数据妥善保管。
- 更换 `TURNSTILE_SECRET` 会使原管理会话失效，需要重新登录。
- 本地变量文件已被 [.gitignore](<.gitignore>) 忽略，但提交前仍需检查改动，避免将凭据误写入其他文件。

## 常见问题

| 现象 | 排查方向 |
| --- | --- |
| 首页可打开，博客或文件 API 报错 | 确认 Worker 绑定了正确的 `ANEKO_KV` / `ANEKO_R2`，不是只上传静态资源；查看 Worker 日志 |
| 提示资源不存在或无访问权限 | 用 `wrangler whoami` 核对账号，确认 KV ID、R2 名称及 API Token 权限；确认 R2 已启用 |
| Turnstile 验证失败 / 403 | 核对前端 Site Key 与后端 Secret 是否配套；核对控制台允许域名、`TURNSTILE_HOSTNAMES` 和实际访问主机名 |
| 人机验证通过但访问码无效 | 确认生产 `ACCESS_CODE` 已上传到正确 Worker，并检查输入中的空格等字符 |
| 登录后管理操作仍返回 401 | 检查 HTTPS、会话 Cookie 和访问码；本地注意 Secure Cookie 行为，切换域名后需重新登录 |
| 邮箱提示未配置或配置不可用 | 确认已保存邮箱设置、KV 记录格式正确，并检查 Worker 是否绑定到预期的 KV Namespace |
| IMAP / SMTP 测试失败 | 检查 993/465 端口、TLS、应用专用密码、服务商限制及 `MAIL_ALLOWED_HOSTS` |
| 相册为空或图片 404 | 检查 KV 清单 Key、JSON 结构和 R2 的 `photos/` 路径；清单中的相对路径不应重复包含前缀 |
| 部署成功但仍显示旧内容 | 确认部署的是正确 Worker 和域名；图片有长期缓存，尝试新文件路径；KV 更新可能需要传播时间 |
| 修改生成配置后重新构建失效 | 应修改根 [wrangler.jsonc](<wrangler.jsonc>)；构建产物每次都会重新生成 |
| 本地内容没有出现在生产 | 本地模拟存储与线上存储独立，必须显式迁移或重新上传内容 |

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动本地开发环境 |
| `pnpm check` | 执行 Astro 和 TypeScript 检查 |
| `pnpm build` | 生成生产构建 |
| `pnpm preview` | 预览构建结果；不等价于线上配置验收 |
| `pnpm run deploy` | 构建并使用生成的 Cloudflare 配置部署 |
| `pnpm cf-typegen` | 运行 Wrangler 生成绑定类型；生成后检查改动 |

## 目录结构

```text
src/
├── components/      # Vue / Astro 组件
├── composables/     # Vue 组合式逻辑
├── layouts/         # 站点、工作台和博客布局
├── pages/           # 页面与服务端 API 路由
│   ├── admin/blog/  # 博客管理后台
│   ├── api/         # 认证、博客、相册、网盘、邮箱等接口
│   ├── blog/        # 博客列表、详情、归档和标签
│   ├── photos/      # 相册
│   ├── mail/        # 邮箱
│   └── drive/       # 网盘
├── plugins/         # Markdown 插件
├── scripts/         # 浏览器脚本
├── types/           # 补充类型
└── utils/           # 存储、鉴权、邮件和运行时配置等
public/              # 图片、字体及其他静态资源
```

## License

[MIT](<LICENSE>)
