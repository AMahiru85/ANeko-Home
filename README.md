# ANeko - Home

ANeko - Home 是参考 zyyo 主页风格，基于 Astro、Vue 和 Cloudflare Workers 构建的个人站点，集成仪表盘、导航、博客、相册、网盘、邮箱和后台管理功能。

## 功能概览

| 页面 | 说明 |
| --- | --- |
| 首页 `/` | 显示时间、天气、GitHub 公开信息、站内功能入口和外部链接。 |
| 博客 `/blog/` | 支持文章列表、文章详情、标签、归档、分页和 RSS。文章正文使用 Markdown，可以关联附件。 |
| 相册 `/photos/` | 展示公开图片，支持查看大图和下载；管理员登录后可上传图片。 |
| 云盘 `/drive/` | 提供目录浏览、文件预览、下载和下载测速；管理员登录后可上传文件和创建文件夹。 |
| 邮箱 `/mail/` | 通过已配置的 IMAP/SMTP 邮箱收取、阅读和发送邮件，并管理邮箱设置。 |
| 博客管理 `/admin/blog/` | 管理员创建、编辑、发布、撤回和删除文章，同时管理文章附件。 |

博客相关入口：

- [博客首页](https://www.aneko.ink/blog/)
- [文章归档](https://www.aneko.ink/blog/archive/)
- [博客介绍](https://www.aneko.ink/blog/about/)
- [RSS](https://www.aneko.ink/rss.xml)

首页 GitHub 模块读取 `AMahiru30` 的公开资料，包括公开仓库、活动和贡献信息。

## 技术组成

- **Astro 7、Vue 3、TypeScript**：负责页面、服务端路由和交互组件。
- **Cloudflare Workers**：运行 SSR 页面和 API。
- **Cloudflare KV**：保存博客索引、相册清单和邮箱配置等结构化数据。
- **Cloudflare R2**：保存博客正文、附件、相册图片和云盘文件。
- **Cloudflare Turnstile**：保护管理员登录和管理操作。
- **IMAP / SMTP**：连接外部邮箱服务。
- **IndexNow**：文章发布、更新或删除后通知搜索引擎；管理页也支持批量提交公开页面。

## 部署到 Cloudflare Workers

### 部署前准备

部署需要以下资源和权限：

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

`ANEKO_KV`、`ANEKO_R2` 和 `ASSETS` 是代码中的固定绑定名。可以修改资源名称，但不能修改这些绑定名。R2 不需要开启公共桶访问，应用通过 Worker 绑定访问对象。

### 配置

部署需要修改以下配置：

| 配置位置 | 修改内容 |
| --- | --- |
| [src/utils/runtime-config.ts](src/utils/runtime-config.ts) | 修改 `SITE_ORIGIN`，填写完整的 HTTPS 源地址，不带路径。 |
| [src/utils/turnstile-client.ts](src/utils/turnstile-client.ts) | 修改前端 `TURNSTILE_SITE_KEY`。 |
| [public/robots.txt](public/robots.txt) | 修改 Sitemap 地址。 |
| Cloudflare Turnstile 控制台 | 添加实际访问的域名。 |
| `wrangler.jsonc` 的 `vars` | 设置你的 `TURNSTILE_HOSTNAMES`，多个主机名用英文逗号分隔。 |
| [src/composables/useGitHub.js](src/composables/useGitHub.js) | 将 `GITHUB_USERNAME` 改为目标 GitHub 用户名，只填写用户名本身，不要加 `@` 或网址；模块使用 GitHub 公开 API，无需 GitHub Token。 |
| [src/components/PageHeader.vue](src/components/PageHeader.vue) | 修改主页欢迎语、个人简介、社交图标链接及抖音、哔哩哔哩、QQ 等二维码图片路径。 |
| [src/components/LeftSidebar.vue](src/components/LeftSidebar.vue) | 修改主页侧栏的位置、学校、标签和时间线内容。 |
| [src/components/PageContent.vue](src/components/PageContent.vue) | 修改主页的模块标题、站内功能入口、外部链接和技能图；模块标题在 `moduleTabs`，站内项目在 `siteProjects`，外部链接在 `externalLinks`。 |
| [src/composables/useWeather.js](src/composables/useWeather.js) | 修改主页天气数据接口 `WEATHER_API`；天气内容由接口返回，页面不使用固定城市配置。 |
| [src/layouts/SiteLayout.astro](src/layouts/SiteLayout.astro) | 修改站点默认标题、首页描述、关键词、作者和社交分享图片等 SEO 信息。 |
| [src/components/PageFooter.vue](src/components/PageFooter.vue) | 修改页脚版权文字；年份会根据当前日期自动更新。 |
| `public/static/img/` 和 `public/static/svg/` | 替换主页使用的头像、背景、Logo、图标、二维码和技能图；替换后保持原文件名，或同步修改组件中的路径。 |

如果页面上的 GitHub 外链也要指向新账号，还需同步修改 [src/components/PageHeader.vue](src/components/PageHeader.vue) 和 [src/pages/blog/about.astro](src/pages/blog/about.astro)。

### 设置生产密钥

先登录目标 Cloudflare 账号，然后在项目目录执行：

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put ACCESS_CODE --config wrangler.jsonc
pnpm exec wrangler secret put TURNSTILE_SECRET --config wrangler.jsonc
pnpm exec wrangler secret put INDEXNOW_KEY --config wrangler.jsonc
```

执行 `secret put` 后按提示输入值。生产密钥不要写入 `wrangler.jsonc`、普通变量、README 或 Git 提交记录。

### 构建并部署

```sh
pnpm install --frozen-lockfile
pnpm run deploy
```

`pnpm run deploy` 会先执行 Astro 构建，再使用生成的 Cloudflare 配置部署 Worker 和静态资源。根目录的 `wrangler.jsonc` 用于声明资源绑定，部署过程中生成的配置文件不需要手工维护。

### 绑定域名和验收

部署完成后，在 Cloudflare 控制台进入 Worker 的 **Settings → Domains & Routes**，添加 Custom Domain，并检查 DNS、证书和 HTTPS 状态。

建议按以下顺序验收：

- 首页、博客、相册、云盘和邮箱可以正常打开。
- `/sitemap.xml` 和 `/robots.txt` 使用了正确的域名。
- 管理员登录和 Turnstile 验证可以完成。
- 博客可以创建和发布文章。
- 相册和云盘可以上传内容并在前台读取。
- 邮箱配置可以连接 IMAP/SMTP，并完成收发测试。
- 访问 `/{INDEXNOW_KEY}.txt` 时返回密钥本身，且博客管理页的“提交收录”能够正常工作。

## 环境变量和密钥

生产配置分为普通变量、Secret 和资源绑定三类。Secret 只能通过 Cloudflare 的密钥配置功能设置；不要将其写入仓库或普通 `vars`。

### Secret

| 名称 | 用途 | 默认值 |
| --- | --- | --- |
| `ACCESS_CODE` | 管理员访问码。 | 无 |
| `TURNSTILE_SECRET` | Turnstile 服务端密钥，同时用于管理员会话签名。 | 无 |
| `INDEXNOW_KEY` | IndexNow 密钥，用于向 IndexNow 主接口和 Bing 提交页面。 | 无 |

`INDEXNOW_KEY` 必须是 8–128 位字母、数字或短横线，并且必须与站点公开的 `/{INDEXNOW_KEY}.txt` 内容一致。

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

## 数据初始化和使用说明

### 博客

首次部署后，博客内容为空是正常情况。管理员登录 `/admin/blog/` 后可以创建第一篇文章。文章发布、更新、撤回和删除成功后，系统会向 IndexNow 提交受影响的文章、列表、归档、标签和分页页面。

管理页中的“提交收录”按钮会同时请求 IndexNow 主接口和 Bing。两个接口可能分别返回接收、等待验证或限流状态；遇到 429 时不要连续重复点击。

### 相册

相册清单保存在 KV，图片对象保存在 R2。管理员可以通过相册页面上传图片。相册中的图片默认公开访问，不能用于保存私密图片。

### 云盘

云盘默认使用 R2 的 `drive/` 前缀。文件列表和下载接口当前允许公开读取，登录主要用于保护上传、删除和创建目录等写操作。请不要将云盘当作私有存储，也不要上传密码、证件和其他敏感资料。

### 邮箱

邮箱功能需要管理员先完成邮箱配置。当前连接方式支持 IMAP TLS 993 和 SMTP TLS 465；部分服务商要求使用应用专用密码。配置 `MAIL_ALLOWED_HOSTS` 后，填写的 IMAP 和 SMTP 主机必须包含在允许列表中。

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

429 表示搜索引擎接口限流。等待响应中的 Retry-After 时间后再试，也可以使用 GitHub Actions 或站外网络提交少量 URL。

## 隐私和安全提醒

- 云盘的文件列表和下载接口是公开的，请勿上传敏感文件。
- 相册图片可以被公开访问。
- `ACCESS_CODE`、`TURNSTILE_SECRET`、`INDEXNOW_KEY`、邮箱密码和 Webhook Token 都属于敏感信息。
- 邮箱配置和邮件内容取决于站点管理员使用的邮箱账号及服务商策略。
- 生产环境的 KV、R2 和 Cloudflare 账号权限应由可信管理员管理。

## 项目源码

源码仓库：<https://github.com/sherrijmac/ANeko-Home>

## License

[MIT](LICENSE)
