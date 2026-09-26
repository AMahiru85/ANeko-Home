<template>
  <section class="blogManager" aria-labelledby="blog-manager-title">
    <header class="managerToolbar">
      <div>
        <p>CONTENT WORKSPACE</p>
        <h2 id="blog-manager-title">文章管理</h2>
      </div>

      <div class="managerCommands">
        <input ref="markdownInput" class="managerFileInput" type="file" accept=".md,text/markdown,text/plain" @change="handleMarkdownInput" />
        <button type="button" :disabled="!isAuthenticated" title="新建文章" @click="openNewEditor">
          <Plus :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>新建</span>
        </button>
        <button type="button" :disabled="!isAuthenticated || status === 'loading'" title="刷新" @click="loadPosts">
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>刷新</span>
        </button>
        <button
          type="button"
          class="managerAuthButton"
          :class="{ 'is-authenticated': isAuthenticated }"
          :title="isAuthenticated ? '退出管理员' : '管理员登录'"
          @click="isAuthenticated ? logout() : showLogin = true"
        >
          <LogOut v-if="isAuthenticated" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <LogIn v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isAuthenticated ? '已登录' : '登录' }}</span>
        </button>
      </div>
    </header>

    <div v-if="notice" class="managerNotice" :class="`is-${noticeKind}`" role="status">
      <CircleCheck v-if="noticeKind === 'success'" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <CircleAlert v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ notice }}</span>
    </div>

    <div v-if="authChecking || status === 'loading'" class="managerSkeleton" aria-label="正在加载文章">
      <span v-for="index in 6" :key="index"></span>
    </div>

    <div v-else-if="!isAuthenticated" class="managerState">
      <LockKeyhole :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>管理员登录</h3>
      <p>登录后可以发布、编辑和删除文章。</p>
      <button type="button" @click="showLogin = true">登录</button>
    </div>

    <div v-else-if="status === 'error'" class="managerState" role="alert">
      <CircleAlert :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>文章读取失败</h3>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadPosts">重新载入</button>
    </div>

    <div v-else-if="posts.length === 0" class="managerState">
      <FileText :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>还没有文章</h3>
      <p>新建第一篇文章后会显示在这里。</p>
      <button type="button" @click="openNewEditor">新建文章</button>
    </div>

    <div v-else class="managerTableWrap">
      <table class="managerTable">
        <thead>
          <tr>
            <th>文章</th>
            <th class="is-status">状态</th>
            <th class="is-date">发布日期</th>
            <th class="is-actions"><span class="srOnly">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.slug">
            <td>
              <button class="managerPostName" type="button" @click="openEditEditor(post.slug)">
                <FileText :size="18" :stroke-width="1.7" aria-hidden="true" />
                <span>
                  <strong>{{ post.title }}</strong>
                  <small>{{ post.slug }}</small>
                </span>
              </button>
            </td>
            <td class="is-status">
              <span class="managerStatus" :class="{ 'is-draft': post.draft }">
                {{ post.draft ? '草稿' : post.featured ? '精选' : '已发布' }}
              </span>
            </td>
            <td class="is-date">{{ formatDate(post.pubDate) }}</td>
            <td class="is-actions">
              <div class="managerRowActions">
                <a v-if="!post.draft" :href="`/blog/${post.slug}/`" target="_blank" rel="noreferrer" title="查看文章" aria-label="查看文章">
                  <Eye :size="15" :stroke-width="1.8" aria-hidden="true" />
                </a>
                <button type="button" title="编辑" aria-label="编辑文章" @click="openEditEditor(post.slug)">
                  <FilePenLine :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button class="is-danger" type="button" title="删除" aria-label="删除文章" @click="deletePost(post)">
                  <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminLoginDialog v-if="loginDialogLoaded" :open="showLogin" @close="showLogin = false" @authenticated="handleAuthenticated" />

    <Teleport v-if="isMounted" to="body">
      <Transition name="manager-editor">
        <div
          v-if="editorOpen"
          class="editorBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-editor-title"
          @mousedown.self="closeEditor"
        >
          <form class="blogEditor" @submit.prevent="savePost">
            <header class="editorHeader">
              <div>
                <p>{{ originalSlug ? 'EDIT ARTICLE' : 'NEW ARTICLE' }}</p>
                <h3 id="blog-editor-title">{{ originalSlug ? '编辑文章' : '新建文章' }}</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" :disabled="editorSaving || editorClosing" @click="closeEditor">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>

            <div v-if="editorLoading" class="editorLoading" aria-label="正在加载文章"><span></span></div>
            <div v-else class="editorScroll">
              <p v-if="editorError" class="editorError" role="alert">{{ editorError }}</p>

              <div class="editorFields">
                <label>
                  <span>Slug</span>
                  <input v-model.trim="form.slug" type="text" autocomplete="off" required :disabled="Boolean(originalSlug)" />
                </label>
                <label>
                  <span>标题</span>
                  <input v-model.trim="form.title" type="text" autocomplete="off" required />
                </label>
                <label class="is-wide">
                  <span>摘要</span>
                  <input v-model.trim="form.description" type="text" autocomplete="off" required />
                </label>
                <label>
                  <span>发布日期</span>
                  <input v-model="form.pubDate" type="datetime-local" required />
                </label>
                <label>
                  <span>更新日期</span>
                  <input v-model="form.updatedDate" type="datetime-local" />
                </label>
                <label>
                  <span>作者</span>
                  <input v-model.trim="form.author" type="text" autocomplete="off" required />
                </label>
                <label>
                  <span>标签</span>
                  <input v-model="form.tags" type="text" autocomplete="off" placeholder="Astro, Cloudflare" />
                </label>
                <label class="is-wide">
                  <span>头图 URL</span>
                  <div class="editorInputAction">
                    <input v-model.trim="form.heroImage" type="text" autocomplete="off" />
                    <input ref="heroInput" class="managerFileInput" type="file" accept="image/*" @change="handleHeroInput" />
                    <button type="button" :disabled="assetUploading" title="上传头图" aria-label="上传头图" @click="heroInput?.click()">
                      <ImagePlus :size="16" :stroke-width="1.8" aria-hidden="true" />
                    </button>
                  </div>
                </label>
              </div>

              <div class="editorFlags">
                <label><input v-model="form.featured" type="checkbox" /><span>精选文章</span></label>
                <label><input v-model="form.draft" type="checkbox" /><span>保存为草稿</span></label>
              </div>

              <section class="editorBodySection" aria-labelledby="editor-body-title">
                <header>
                  <label id="editor-body-title" for="blog-editor-body">Markdown 正文</label>
                  <div>
                    <button type="button" title="导入 Markdown" :disabled="assetUploading" @click="markdownInput?.click()">
                      <Upload :size="15" :stroke-width="1.8" aria-hidden="true" />
                      <span>导入正文</span>
                    </button>
                    <input ref="assetInput" class="managerFileInput" type="file" multiple @change="handleAssetInput" />
                    <button type="button" title="上传附件" :disabled="assetUploading" @click="assetInput?.click()">
                      <Paperclip :size="15" :stroke-width="1.8" aria-hidden="true" />
                      <span>{{ assetUploading ? '上传中' : '附件' }}</span>
                    </button>
                  </div>
                </header>
                <textarea id="blog-editor-body" ref="bodyEditor" v-model="form.body" required spellcheck="false"></textarea>
              </section>

              <section v-if="assets.length" class="editorAssets" aria-labelledby="editor-assets-title">
                <header>
                  <p>ATTACHMENTS</p>
                  <h4 id="editor-assets-title">文章附件</h4>
                </header>
                <div class="editorAssetList">
                  <div v-for="asset in assets" :key="asset.path" class="editorAssetRow">
                    <span>
                      <strong>{{ fileName(asset.path) }}</strong>
                      <small>{{ formatFileSize(asset.size) }}</small>
                    </span>
                    <div>
                      <button type="button" title="插入正文" aria-label="插入正文" @click="insertAsset(asset)">
                        <FilePlus2 :size="15" :stroke-width="1.8" aria-hidden="true" />
                      </button>
                      <button type="button" title="复制链接" aria-label="复制链接" @click="copyAsset(asset)">
                        <Copy :size="15" :stroke-width="1.8" aria-hidden="true" />
                      </button>
                      <button class="is-danger" type="button" title="删除附件" aria-label="删除附件" @click="deleteAsset(asset)">
                        <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <footer class="editorFooter">
              <button type="button" :disabled="editorSaving || editorClosing" @click="closeEditor">取消</button>
              <button class="is-primary" type="submit" :disabled="editorLoading || editorSaving || editorClosing || assetUploading">
                <Save :size="15" :stroke-width="1.8" aria-hidden="true" />
                <span>{{ editorSaving ? '保存中' : '保存文章' }}</span>
              </button>
            </footer>
          </form>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  FilePenLine,
  FilePlus2,
  FileText,
  ImagePlus,
  LockKeyhole,
  LogIn,
  LogOut,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import { apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'
import { isValidBlogSlug } from '../utils/blog-config'

const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))

interface StoredBlogPost {
  slug: string
  title: string
  description: string
  pubDate: string
  updatedDate?: string
  heroImage?: string
  tags: string[]
  author: string
  featured: boolean
  draft: boolean
  readingTime: number
  bodyKey: string
}

interface EditableBlogPost extends StoredBlogPost {
  body: string
}

interface BlogAsset {
  path: string
  size: number
  uploaded: string
  contentType?: string
}

interface BlogForm {
  slug: string
  title: string
  description: string
  pubDate: string
  updatedDate: string
  heroImage: string
  tags: string
  author: string
  featured: boolean
  draft: boolean
  body: string
}

type ManagerStatus = 'loading' | 'ready' | 'error'

const blogManagerDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
})

const posts = ref<StoredBlogPost[]>([])
const isMounted = ref(false)
const assets = ref<BlogAsset[]>([])
const accessCode = ref('')
const isAuthenticated = computed(() => Boolean(accessCode.value))
const authChecking = ref(true)
const showLogin = ref(false)
const loginDialogLoaded = ref(false)
const status = ref<ManagerStatus>('ready')
const errorMessage = ref('')
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const editorOpen = ref(false)
const editorLoading = ref(false)
const editorSaving = ref(false)
const editorClosing = ref(false)
const editorError = ref('')
const originalSlug = ref('')
const assetUploading = ref(false)
const temporaryAssetPaths = ref<string[]>([])
const bodyEditor = ref<HTMLTextAreaElement | null>(null)
const markdownInput = ref<HTMLInputElement | null>(null)
const heroInput = ref<HTMLInputElement | null>(null)
const assetInput = ref<HTMLInputElement | null>(null)
let noticeTimer: number | null = null

watch(showLogin, (open) => {
  if (open) loginDialogLoaded.value = true
}, { flush: 'sync' })

const form = reactive<BlogForm>(emptyForm())

function toLocalDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function emptyForm(): BlogForm {
  return {
    slug: '',
    title: '',
    description: '',
    pubDate: toLocalDateTime(new Date()),
    updatedDate: '',
    heroImage: '',
    tags: '',
    author: 'ANeko',
    featured: false,
    draft: false,
    body: '',
  }
}

function authHeaders(contentType?: string) {
  return {
    'X-Access-Code': accessCode.value,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

async function loadPosts() {
  if (!accessCode.value) return
  status.value = 'loading'
  errorMessage.value = ''

  try {
    posts.value = await apiRequest<StoredBlogPost[]>('/api/admin/blog', {
      headers: authHeaders(),
      cache: 'no-store',
    })
    status.value = 'ready'
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '无法读取文章'
  }
}

function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  showNotice('管理员登录成功')
  loadPosts()
}

function logout() {
  clearAdminAccess()
  accessCode.value = ''
  posts.value = []
  showNotice('已退出管理员')
}

function openNewEditor() {
  Object.assign(form, emptyForm())
  originalSlug.value = ''
  assets.value = []
  temporaryAssetPaths.value = []
  editorError.value = ''
  editorLoading.value = false
  editorOpen.value = true
}

async function openEditEditor(slug: string) {
  originalSlug.value = slug
  editorError.value = ''
  editorLoading.value = true
  editorOpen.value = true
  assets.value = []
  temporaryAssetPaths.value = []

  try {
    const query = new URLSearchParams({ slug })
    const [post, nextAssets] = await Promise.all([
      apiRequest<EditableBlogPost>(`/api/admin/blog/${encodeURIComponent(slug)}`, {
        headers: authHeaders(),
        cache: 'no-store',
      }),
      apiRequest<BlogAsset[]>(`/api/admin/blog/assets?${query}`, {
        headers: authHeaders(),
        cache: 'no-store',
      }),
    ])

    Object.assign(form, {
      slug: post.slug,
      title: post.title,
      description: post.description,
      pubDate: toLocalDateTime(post.pubDate),
      updatedDate: post.updatedDate ? toLocalDateTime(post.updatedDate) : '',
      heroImage: post.heroImage || '',
      tags: post.tags.join(', '),
      author: post.author || 'ANeko',
      featured: post.featured,
      draft: post.draft,
      body: post.body,
    })
    assets.value = nextAssets
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '无法读取文章'
  } finally {
    editorLoading.value = false
  }
}

function validateSlug(slug: string) {
  return isValidBlogSlug(slug)
}

async function savePost() {
  editorError.value = ''
  const slug = form.slug.trim()
  if (!validateSlug(slug)) {
    editorError.value = 'Slug 只能使用字母、数字和连字符，且不能与系统页面重名'
    return
  }

  editorSaving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      pubDate: new Date(form.pubDate).toISOString(),
      updatedDate: form.updatedDate ? new Date(form.updatedDate).toISOString() : undefined,
      heroImage: form.heroImage.trim() || undefined,
      tags: form.tags.split(/[,，\n]+/).map((tag) => tag.trim()).filter(Boolean),
      author: form.author.trim() || 'ANeko',
      featured: form.featured,
      draft: form.draft,
      body: form.body.trim(),
    }

    await apiRequest<StoredBlogPost>(`/api/admin/blog/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: authHeaders('application/json'),
      body: JSON.stringify(payload),
    })

    temporaryAssetPaths.value = []
    editorOpen.value = false
    showNotice(form.draft ? '草稿已保存' : '文章已发布')
    await loadPosts()
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    editorSaving.value = false
  }
}

async function deletePost(post: StoredBlogPost) {
  if (!window.confirm(`确定删除“${post.title}”吗？正文和文章目录内的附件也会被删除。`)) return

  try {
    await apiRequest(`/api/admin/blog/${encodeURIComponent(post.slug)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    showNotice('文章已删除')
    await loadPosts()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '删除失败', 'error')
  }
}

function encodeObjectPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function safeFileName(name: string) {
  const normalized = name.normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized && normalized !== '.' && normalized !== '..' ? normalized : 'file'
}

async function uploadAsset(file: File) {
  const slug = form.slug.trim()
  if (!validateSlug(slug)) throw new Error('请先填写有效的 Slug')

  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName(file.name)}`
  const path = `${slug}/${uniqueName}`
  const result = await apiRequest<{ path: string }>(`/api/blog/assets/${encodeObjectPath(path)}`, {
    method: 'PUT',
    headers: authHeaders(file.type || 'application/octet-stream'),
    body: file,
  })

  temporaryAssetPaths.value.push(path)
  assets.value.unshift({
    path,
    size: file.size,
    uploaded: new Date().toISOString(),
    contentType: file.type,
  })
  return result.path
}

async function handleHeroInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  assetUploading.value = true
  editorError.value = ''
  try {
    form.heroImage = await uploadAsset(file)
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '头图上传失败'
  } finally {
    assetUploading.value = false
    input.value = ''
  }
}

async function handleAssetInput(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  assetUploading.value = true
  editorError.value = ''

  try {
    const snippets: string[] = []
    for (const file of files) {
      const url = await uploadAsset(file)
      snippets.push(file.type.startsWith('image/')
        ? `![${file.name}](${url})`
        : `[${file.name}](${url})`)
    }
    insertBodyText(`\n\n${snippets.join('\n\n')}\n`)
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '附件上传失败'
  } finally {
    assetUploading.value = false
    input.value = ''
  }
}

async function handleMarkdownInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const raw = await file.text()
    form.body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
    const stem = file.name.replace(/\.[^.]+$/, '')
    if (!form.title) form.title = stem
    if (!form.slug) {
      form.slug = stem.normalize('NFKC')
        .replace(/[\s_]+/g, '-')
        .replace(/[^\p{L}\p{N}-]/gu, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }
  } catch {
    editorError.value = '无法读取 Markdown 文件'
  } finally {
    input.value = ''
  }
}

function assetUrl(asset: BlogAsset) {
  return `/api/blog/assets/${encodeObjectPath(asset.path)}`
}

function insertAsset(asset: BlogAsset) {
  const url = assetUrl(asset)
  const name = fileName(asset.path)
  const isImage = asset.contentType?.startsWith('image/') || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(name)
  insertBodyText(`\n\n${isImage ? `![${name}](${url})` : `[${name}](${url})`}\n`)
}

function insertBodyText(text: string) {
  const editor = bodyEditor.value
  if (!editor) {
    form.body += text
    return
  }
  const start = editor.selectionStart
  const end = editor.selectionEnd
  editor.setRangeText(text, start, end, 'end')
  form.body = editor.value
  editor.focus()
}

async function copyAsset(asset: BlogAsset) {
  try {
    await navigator.clipboard.writeText(new URL(assetUrl(asset), window.location.href).href)
    showNotice('附件链接已复制')
  } catch {
    showNotice('复制失败', 'error')
  }
}

async function deleteAsset(asset: BlogAsset) {
  if (!window.confirm(`确定删除“${fileName(asset.path)}”吗？`)) return
  try {
    await apiRequest(`/api/blog/assets/${encodeObjectPath(asset.path)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    assets.value = assets.value.filter((item) => item.path !== asset.path)
    temporaryAssetPaths.value = temporaryAssetPaths.value.filter((path) => path !== asset.path)
    if (form.heroImage === assetUrl(asset)) form.heroImage = ''
    showNotice('附件已删除')
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '附件删除失败'
  }
}

async function cleanupTemporaryAssets() {
  const paths = [...temporaryAssetPaths.value]
  temporaryAssetPaths.value = []
  await Promise.allSettled(paths.map((path) => apiRequest(`/api/blog/assets/${encodeObjectPath(path)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })))
}

async function closeEditor() {
  if (editorSaving.value || editorClosing.value) return
  if (!window.confirm('放弃本次编辑吗？未保存的内容将丢失。')) return
  editorClosing.value = true
  await cleanupTemporaryAssets()
  editorOpen.value = false
  editorClosing.value = false
}

function fileName(path: string) {
  return path.split('/').at(-1) || path
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** index)
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : blogManagerDateFormatter.format(date)
}

function showNotice(message: string, kind: 'success' | 'error' = 'success') {
  notice.value = message
  noticeKind.value = kind
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 2600)
}

watch(editorOpen, (open) => {
  document.documentElement.style.overflow = open ? 'hidden' : ''
})

onMounted(async () => {
  isMounted.value = true
  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadPosts()
})

onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('overflow')
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
})
</script>

<style scoped>
.blogManager {
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
}

.managerToolbar {
  min-height: 112px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
}

.managerToolbar p,
.editorHeader p,
.editorAssets header p {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.managerToolbar h2 { margin: 5px 0 0; font-size: 25px; line-height: 32px; }
.managerCommands { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 7px; }
.managerFileInput { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.managerCommands button,
.managerState button,
.editorFooter button,
.editorBodySection header button {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font-size: 10px;
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.managerCommands button:hover,
.managerState button:hover,
.editorFooter button:hover,
.editorBodySection header button:hover { border-color: var(--module_dock_active_border); background: var(--item_hover_color); transform: translateY(-1px); }
.managerCommands button:disabled,
.editorFooter button:disabled,
.editorBodySection header button:disabled { opacity: 0.35; pointer-events: none; }
.managerAuthButton.is-authenticated { border-color: rgba(90, 160, 118, 0.4); }

.managerNotice {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--item_bg_color);
  font-size: 10px;
}
.managerNotice.is-error { color: #b14646; }

.managerSkeleton { border-bottom: 1px solid var(--module_dock_border); }
.managerSkeleton span {
  height: 68px;
  border-bottom: 1px solid var(--module_dock_border);
  display: block;
  background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%);
  background-size: 220% 100%;
  animation: managerShimmer 1.35s ease-in-out infinite;
}

.managerState {
  min-height: 350px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.managerState h3 { margin: 14px 0 0; font-size: 18px; line-height: 25px; }
.managerState p { margin: 6px 0 0; font-size: 10px; opacity: 0.54; }
.managerState button { margin-top: 18px; }

.managerTableWrap { overflow-x: auto; border-bottom: 1px solid var(--module_dock_active_border); }
.managerTable { width: 100%; border-collapse: collapse; table-layout: fixed; }
.managerTable th { height: 42px; padding: 0 12px; border-bottom: 1px solid var(--module_dock_border); font-size: 8px; font-weight: 600; text-align: left; opacity: 0.46; }
.managerTable .is-status { width: 96px; }
.managerTable .is-date { width: 130px; }
.managerTable .is-actions { width: 130px; }
.managerTable tbody tr { height: 68px; border-bottom: 1px solid var(--module_dock_border); }
.managerTable tbody tr:hover { background: color-mix(in srgb, var(--item_hover_color) 68%, transparent); }
.managerTable td { padding: 0 12px; font-size: 10px; }

.managerPostName {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.managerPostName > span { min-width: 0; display: grid; gap: 3px; }
.managerPostName strong { overflow: hidden; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.managerPostName small { overflow: hidden; font-size: 8px; font-weight: 400; opacity: 0.45; text-overflow: ellipsis; white-space: nowrap; }

.managerStatus { padding: 4px 7px; border: 1px solid rgba(90, 160, 118, 0.3); border-radius: 4px; font-size: 8px; }
.managerStatus.is-draft { border-color: var(--module_dock_border); opacity: 0.56; }
.managerRowActions { display: flex; justify-content: flex-end; gap: 3px; opacity: 0; transition: opacity 0.2s ease; }
.managerTable tr:hover .managerRowActions,
.managerRowActions:focus-within { opacity: 1; }
.managerRowActions button,
.managerRowActions a,
.editorHeader > button,
.editorAssetRow button,
.editorInputAction button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
.managerRowActions button:hover,
.managerRowActions a:hover,
.editorHeader > button:hover,
.editorAssetRow button:hover,
.editorInputAction button:hover { border-color: var(--weather_dialog_line); background: var(--weather_dialog_control_hover); }
.is-danger:hover { color: #c14e4e; }

.editorBackdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--weather_dialog_backdrop);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.blogEditor {
  width: min(1080px, 100%);
  max-height: calc(100dvh - 36px);
  border: 1px solid var(--weather_dialog_border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_bg);
  box-shadow: 0 24px 70px -34px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset);
}
.editorHeader { min-height: 74px; padding: 18px 20px 14px; border-bottom: 1px solid var(--weather_dialog_line); display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.editorHeader h3 { margin: 3px 0 0; font-size: 18px; line-height: 24px; }
.editorScroll { min-height: 0; padding: 18px 20px 24px; overflow-y: auto; }
.editorLoading { min-height: 420px; padding: 20px; }
.editorLoading span { height: 100%; min-height: 380px; display: block; background: linear-gradient(100deg, transparent 20%, var(--weather_dialog_surface) 45%, transparent 70%); background-size: 220% 100%; animation: managerShimmer 1.35s ease-in-out infinite; }
.editorError { margin: 0 0 14px; padding: 10px 12px; border: 1px solid rgba(193, 78, 78, 0.25); border-radius: 6px; color: #b14646; background: rgba(193, 78, 78, 0.06); font-size: 10px; }
.editorFields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.editorFields label { min-width: 0; display: grid; gap: 7px; }
.editorFields label.is-wide { grid-column: 1 / -1; }
.editorFields label > span,
.editorBodySection > header > label { color: var(--weather_dialog_muted); font-size: 9px; line-height: 13px; }
.editorFields input,
.editorBodySection textarea {
  width: 100%;
  border: 1px solid var(--weather_dialog_line_strong);
  border-radius: 6px;
  outline: 0;
  color: inherit;
  background: var(--weather_dialog_control_bg);
  font: inherit;
  font-size: 11px;
}
.editorFields input { height: 42px; padding: 0 11px; }
.editorFields input:focus,
.editorBodySection textarea:focus { border-color: var(--weather_dialog_focus); }
.editorFields input:disabled { opacity: 0.55; }
.editorInputAction { display: grid; grid-template-columns: minmax(0, 1fr) 42px; }
.editorInputAction input { border-radius: 6px 0 0 6px; }
.editorInputAction button { width: 42px; height: 42px; border: 1px solid var(--weather_dialog_line_strong); border-left: 0; border-radius: 0 6px 6px 0; background: var(--weather_dialog_control_bg); }
.editorFlags { padding: 18px 0 4px; display: flex; flex-wrap: wrap; gap: 18px; }
.editorFlags label { display: inline-flex; align-items: center; gap: 7px; font-size: 10px; cursor: pointer; }
.editorFlags input { width: 15px; height: 15px; accent-color: var(--weather_dialog_active_bg); }
.editorBodySection { margin-top: 16px; }
.editorBodySection > header { min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.editorBodySection > header > div { display: flex; gap: 6px; }
.editorBodySection textarea { min-height: 360px; padding: 14px; resize: vertical; font: 11px/19px "Cascadia Code", Consolas, monospace; }
.editorAssets { margin-top: 20px; border-top: 1px solid var(--weather_dialog_line); }
.editorAssets > header { padding: 16px 0 10px; }
.editorAssets h4 { margin: 3px 0 0; font-size: 14px; }
.editorAssetList { border-top: 1px solid var(--weather_dialog_line); }
.editorAssetRow { min-height: 52px; padding: 7px 4px; border-bottom: 1px solid var(--weather_dialog_line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.editorAssetRow > span { min-width: 0; display: grid; gap: 3px; }
.editorAssetRow strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.editorAssetRow small { font-size: 8px; opacity: 0.46; }
.editorAssetRow > div { flex: 0 0 auto; display: flex; gap: 2px; }
.editorFooter { min-height: 66px; padding: 12px 20px; border-top: 1px solid var(--weather_dialog_line); display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.editorFooter button { color: var(--weather_dialog_text); background: var(--weather_dialog_control_bg); }
.editorFooter button.is-primary { border-color: var(--weather_dialog_active_bg); color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); }
.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.manager-editor-enter-active,
.manager-editor-leave-active { transition: opacity 0.22s ease; }
.manager-editor-enter-active .blogEditor,
.manager-editor-leave-active .blogEditor { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease; }
.manager-editor-enter-from,
.manager-editor-leave-to { opacity: 0; }
.manager-editor-enter-from .blogEditor,
.manager-editor-leave-to .blogEditor { opacity: 0; transform: translateY(10px) scale(0.985); }

@keyframes managerShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }

@media (max-width: 800px) {
  .blogManager { width: calc(100% - 18px); margin: 0 9px; }
  .managerRowActions { opacity: 1; }
}

@media (max-width: 640px) {
  .managerToolbar { align-items: flex-start; flex-direction: column; }
  .managerCommands { width: 100%; justify-content: flex-start; }
  .managerCommands .managerAuthButton { margin-left: auto; }
  .managerCommands button span { display: none; }
  .managerCommands button { width: 36px; padding: 0; }
  .managerTable .is-date { display: none; }
  .managerTable .is-status { width: 74px; }
  .managerTable .is-actions { width: 104px; }
  .managerTable th,
  .managerTable td { padding-right: 7px; padding-left: 7px; }
  .editorBackdrop { padding: 8px; }
  .blogEditor { max-height: calc(100dvh - 16px); }
  .editorHeader { min-height: 66px; padding: 14px; }
  .editorScroll { padding: 14px; }
  .editorFields { grid-template-columns: 1fr; }
  .editorFields label.is-wide { grid-column: auto; }
  .editorBodySection > header { align-items: flex-start; flex-direction: column; }
  .editorBodySection > header > div { width: 100%; }
  .editorBodySection > header button { flex: 1 1 0; }
  .editorBodySection textarea { min-height: 300px; }
  .editorFooter { padding: 10px 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .managerSkeleton span,
  .editorLoading span { animation: none; }
  .manager-editor-enter-active,
  .manager-editor-leave-active,
  .manager-editor-enter-active .blogEditor,
  .manager-editor-leave-active .blogEditor { transition: none; }
}
</style>
