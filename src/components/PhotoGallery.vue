<template>
  <section
    class="photoGallery"
    aria-labelledby="photo-gallery-title"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <header class="photoGalleryMeta">
      <div>
        <p>FRAME INDEX</p>
        <h2 id="photo-gallery-title">全部照片</h2>
      </div>
      <div class="photoGalleryStatus">
        <span>{{ String(flatImages.length).padStart(2, '0') }} FRAMES</span>
        <input ref="uploadInput" class="photoFileInput" type="file" accept="image/*" multiple @change="handleUploadInput" />
        <button
          v-if="isAuthenticated"
          class="photoCommandButton"
          type="button"
          title="上传照片"
          :disabled="isUploading"
          @click="uploadInput?.click()"
        >
          <Upload :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isUploading ? '上传中' : '上传' }}</span>
        </button>
        <button type="button" title="刷新相册" aria-label="刷新相册" :disabled="status === 'loading'" @click="loadPhotos(true)">
          <RefreshCw :size="16" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <button
          class="photoCommandButton photoAuthButton"
          :class="{ 'is-authenticated': isAuthenticated }"
          type="button"
          :title="isAuthenticated ? '退出管理员' : '管理员登录'"
          @click="isAuthenticated ? logout() : showLogin = true"
        >
          <LogOut v-if="isAuthenticated" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <LogIn v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isAuthenticated ? '已登录' : '登录' }}</span>
        </button>
      </div>
    </header>

    <div v-if="operationMessage" class="photoNotice" :class="`is-${operationKind}`" role="status">
      <CircleCheck v-if="operationKind === 'success'" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <CircleAlert v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ operationMessage }}</span>
    </div>

    <div v-if="status === 'loading'" class="photoSkeletonGrid" aria-label="正在加载相册">
      <span v-for="index in 10" :key="index" :class="`shape-${(index % 4) + 1}`"></span>
    </div>

    <div v-else-if="status === 'error'" class="workspaceState" role="alert">
      <Images :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>相册载入失败</h3>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadPhotos(true)">重新载入</button>
    </div>

    <div v-else-if="status === 'empty'" class="workspaceState">
      <Images :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>暂时没有照片</h3>
      <p>{{ isAuthenticated ? '可以直接上传照片。' : '管理员登录后可以上传照片。' }}</p>
      <button v-if="isAuthenticated" type="button" @click="uploadInput?.click()">上传照片</button>
      <button v-else type="button" @click="showLogin = true">管理员登录</button>
    </div>

    <div v-else ref="masonryRoot" class="photoMasonry" aria-label="照片列表">
      <article
        v-for="(photo, index) in photos"
        :key="photo.key"
        class="photoTile"
        :class="{ 'has-entry-animation': index < 24 }"
        :style="{ '--photo-index': index % 12 }"
      >
        <button
          type="button"
          :aria-label="photo.description || photo.title || `查看第 ${index + 1} 张照片`"
          @click="openPhoto(photo.key)"
        >
          <span class="photoMedia">
            <img
              :src="photo.images[0].src"
              :alt="photo.description || photo.title || '相册照片'"
              :loading="index < 6 ? 'eager' : 'lazy'"
              :fetchpriority="index < 3 ? 'high' : 'auto'"
              decoding="async"
              @load="markLoaded(photo.key, $event)"
              @error="markLoaded(photo.key, $event)"
            />
            <span
              v-if="!loadedPhotos.has(photo.key)"
              class="photoTileSkeleton"
              :class="{ 'is-animated': index < 24 }"
            ></span>
          </span>
        </button>
        <div v-if="isAuthenticated" class="photoAdminActions" role="toolbar" :aria-label="`管理 ${photo.title || `第 ${index + 1} 张照片`}`">
          <button type="button" title="前移" aria-label="前移" :disabled="photo.sourceIndex === 0 || operationBusy" @click="movePhoto(photo.sourceIndex, -1)">
            <ArrowLeft :size="15" :stroke-width="1.9" aria-hidden="true" />
          </button>
          <button type="button" title="编辑信息" aria-label="编辑信息" :disabled="operationBusy" @click="openEditPhoto(photo.sourceIndex)">
            <Pencil :size="15" :stroke-width="1.9" aria-hidden="true" />
          </button>
          <button class="is-danger" type="button" title="删除照片" aria-label="删除照片" :disabled="operationBusy" @click="deletePhoto(photo.sourceIndex)">
            <Trash2 :size="15" :stroke-width="1.9" aria-hidden="true" />
          </button>
          <button type="button" title="后移" aria-label="后移" :disabled="photo.sourceIndex >= manifest.length - 1 || operationBusy" @click="movePhoto(photo.sourceIndex, 1)">
            <ArrowRight :size="15" :stroke-width="1.9" aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>

    <div v-if="isDragging" class="photoDropOverlay" aria-hidden="true">
      <Upload :size="28" :stroke-width="1.5" />
      <span>{{ isAuthenticated ? '释放以上传照片' : '请先登录管理员' }}</span>
    </div>

    <div
      v-if="pageBarVisible"
      class="photoScrollbar"
      :class="{ 'is-visible': pageBarShown }"
      :style="{ left: `${pageBarLeft}px` }"
      @pointerdown="handleTrackDown"
    >
      <div
        class="photoScrollbarThumb"
        :class="{ 'is-dragging': pageBarDragging }"
        :style="{ height: `${pageBarThumbH}px`, transform: `translateY(${pageBarThumbY}px)` }"
        @pointerdown.stop.prevent="handleThumbDown"
      ></div>
    </div>

    <AdminLoginDialog v-if="loginDialogLoaded" :open="showLogin" @close="showLogin = false" @authenticated="handleAuthenticated" />

    <Teleport v-if="isMounted" to="body">
      <Transition name="photo-modal">
        <div v-if="editingIndex >= 0" class="photoModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="photo-edit-title" @mousedown.self="closeEditPhoto">
          <form class="photoEditModal" @submit.prevent="savePhotoDetails">
            <header>
              <div>
                <p>FRAME DETAILS</p>
                <h3 id="photo-edit-title">编辑照片</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" :disabled="operationBusy" @click="closeEditPhoto">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>
            <label for="photo-edit-title-input">标题</label>
            <input id="photo-edit-title-input" v-model.trim="editForm.title" type="text" autocomplete="off" />
            <label for="photo-edit-date">日期</label>
            <input id="photo-edit-date" v-model.trim="editForm.date" type="text" autocomplete="off" />
            <label for="photo-edit-description">描述</label>
            <textarea id="photo-edit-description" v-model.trim="editForm.description" rows="4"></textarea>
            <p v-if="editError" class="photoFormError">{{ editError }}</p>
            <button class="photoPrimaryButton" type="submit" :disabled="operationBusy">
              <Save :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ operationBusy ? '保存中' : '保存' }}</span>
            </button>
          </form>
        </div>
      </Transition>

      <Transition name="photo-lightbox">
        <div v-if="activeImage" class="photoLightbox" role="dialog" aria-modal="true" aria-label="照片预览" @click.self="closeLightbox">
          <button
            class="photoLightboxNav is-prev"
            type="button"
            title="上一张"
            aria-label="上一张"
            :disabled="activeImageIndex <= 0"
            @click="moveLightbox(-1)"
          >
            <ChevronLeft :size="22" :stroke-width="1.8" aria-hidden="true" />
          </button>

          <figure class="photoLightboxFigure" @click.self="closeLightbox">
            <img
              :key="activeImage.image.src"
              :src="activeImage.image.src"
              :alt="activeImage.photo.description || activeImage.photo.title || '相册照片'"
            />
          </figure>

          <button
            class="photoLightboxNav is-next"
            type="button"
            title="下一张"
            aria-label="下一张"
            :disabled="activeImageIndex >= flatImages.length - 1"
            @click="moveLightbox(1)"
          >
            <ChevronRight :size="22" :stroke-width="1.8" aria-hidden="true" />
          </button>

          <div class="photoLightboxActions" role="toolbar" aria-label="照片操作" @click.self="closeLightbox">
            <a :href="`${activeImage.image.src}?download`" download title="下载" aria-label="下载照片">
              <Download :size="17" :stroke-width="1.8" aria-hidden="true" />
            </a>
            <a :href="activeImage.image.src" target="_blank" rel="noreferrer" title="查看原图" aria-label="查看原图">
              <ExternalLink :size="17" :stroke-width="1.8" aria-hidden="true" />
            </a>
            <button type="button" title="分享" aria-label="复制照片链接" @click="shareActiveImage">
              <Share2 :size="17" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </div>

          <Transition name="photo-toast">
            <div v-if="toastMessage" class="photoToast" role="status">{{ toastMessage }}</div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  ExternalLink,
  Images,
  LogIn,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import { apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'

const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))

interface RawPhoto {
  title?: string
  date?: string
  description?: string
  images?: { img?: string }[]
}

interface GalleryImage {
  path: string
  src: string
}

interface GalleryPhoto {
  key: string
  sourceIndex: number
  title: string
  date: string
  description: string
  images: GalleryImage[]
}

type GalleryStatus = 'loading' | 'ready' | 'empty' | 'error'

const status = ref<GalleryStatus>('loading')
const isMounted = ref(false)
const masonryRoot = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const manifest = ref<RawPhoto[]>([])
const photos = ref<GalleryPhoto[]>([])
const loadedPhotos = ref(new Set<string>())
const activeImageIndex = ref(-1)
const toastMessage = ref('')
const accessCode = ref('')
const isAuthenticated = computed(() => Boolean(accessCode.value))
const showLogin = ref(false)
const loginDialogLoaded = ref(false)
const uploadInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const operationBusy = ref(false)
const operationMessage = ref('')
const operationKind = ref<'success' | 'error'>('success')
const isDragging = ref(false)
const dragDepth = ref(0)
const editingIndex = ref(-1)
const editError = ref('')
const editForm = reactive({ title: '', date: '', description: '' })
let abortController: AbortController | null = null
let toastTimer: number | null = null
let operationTimer: number | null = null
let masonryFrame: number | null = null
let masonryObserver: ResizeObserver | null = null
let observedMasonryWidth = 0
let masonryLayoutAll = false
const pendingMasonryTiles = new Set<HTMLElement>()

const flatImages = computed(() => photos.value.flatMap((photo) => (
  photo.images.map((image) => ({ photo, image }))
)))
const activeImage = computed(() => flatImages.value[activeImageIndex.value] || null)

watch(showLogin, (open) => {
  if (open) loginDialogLoaded.value = true
}, { flush: 'sync' })

function encodePath(path: string) {
  return path
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(encodeURIComponent)
    .join('/')
}

function normalizePhoto(photo: RawPhoto, index: number): GalleryPhoto | null {
  if (!photo || typeof photo !== 'object') return null

  const images = (Array.isArray(photo.images) ? photo.images : [])
    .map((image) => typeof image?.img === 'string' ? image.img.trim() : '')
    .filter(Boolean)
    .map((path) => ({ path, src: `/api/photos/image/${encodePath(path)}` }))

  if (!images.length) return null

  return {
    key: `${images[0].path}:${index}`,
    sourceIndex: index,
    title: photo.title || photo.description || '',
    date: photo.date || '',
    description: photo.description || photo.title || '',
    images,
  }
}

async function applyManifest(nextManifest: RawPhoto[]) {
  manifest.value = nextManifest.map((photo) => ({
    title: photo.title,
    date: photo.date,
    description: photo.description,
    images: (photo.images || []).map((image) => ({ img: image.img })),
  }))
  photos.value = manifest.value
    .map((photo, index) => normalizePhoto(photo, index))
    .filter((photo): photo is GalleryPhoto => Boolean(photo))
  loadedPhotos.value = new Set()
  status.value = photos.value.length ? 'ready' : 'empty'
  await nextTick()
  observedMasonryWidth = 0
  if (masonryRoot.value) masonryObserver?.observe(masonryRoot.value)
  scheduleMasonryLayout()
}

async function loadPhotos(forceRefresh = false) {
  abortController?.abort()
  abortController = new AbortController()
  masonryObserver?.disconnect()
  status.value = 'loading'
  errorMessage.value = ''

  try {
    const response = await fetch('/api/photos', {
      cache: forceRefresh ? 'reload' : 'default',
      signal: abortController.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload)) throw new Error('照片清单格式不正确')

    await applyManifest(payload as RawPhoto[])
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '无法读取照片清单'
  }
}

function scheduleMasonryLayout(tile?: HTMLElement | null) {
  if (tile && !masonryLayoutAll) {
    pendingMasonryTiles.add(tile)
  } else if (!tile) {
    masonryLayoutAll = true
    pendingMasonryTiles.clear()
  }
  if (masonryFrame !== null) return

  masonryFrame = requestAnimationFrame(() => {
    masonryFrame = null
    const root = masonryRoot.value
    const layoutAll = masonryLayoutAll
    const pendingTiles = [...pendingMasonryTiles]
    masonryLayoutAll = false
    pendingMasonryTiles.clear()
    if (!root) return

    const styles = getComputedStyle(root)
    const rowHeight = Number.parseFloat(styles.gridAutoRows) || 1
    const rowGap = Number.parseFloat(styles.rowGap) || 0
    const tiles = layoutAll
      ? [...root.querySelectorAll<HTMLElement>('.photoTile')]
      : pendingTiles.filter((item) => item.isConnected)
    const updates: Array<{ tile: HTMLElement; rowSpan: number }> = []

    tiles.forEach((item) => {
      const image = item.querySelector<HTMLImageElement>('img')
      const width = item.getBoundingClientRect().width
      if (!image || !width) return
      const ratio = image.naturalWidth > 0 ? image.naturalHeight / image.naturalWidth : 1
      const rowSpan = Math.ceil(((width * ratio) + rowGap) / (rowHeight + rowGap))
      updates.push({ tile: item, rowSpan: Math.max(1, rowSpan) })
    })
    updates.forEach(({ tile: item, rowSpan }) => {
      item.style.gridRowEnd = `span ${rowSpan}`
    })
    schedulePageBar()
  })
}

function markLoaded(photoKey: string, event: Event) {
  loadedPhotos.value.add(photoKey)
  const image = event.currentTarget
  const tile = image instanceof HTMLImageElement
    ? image.closest<HTMLElement>('.photoTile')
    : null
  scheduleMasonryLayout(tile)
}

function openPhoto(photoKey: string) {
  const nextIndex = flatImages.value.findIndex((entry) => entry.photo.key === photoKey)
  if (nextIndex < 0) return
  activeImageIndex.value = nextIndex
  document.documentElement.style.overflow = 'hidden'
}

function closeLightbox() {
  activeImageIndex.value = -1
  document.documentElement.style.removeProperty('overflow')
}

function moveLightbox(direction: -1 | 1) {
  const nextIndex = activeImageIndex.value + direction
  if (nextIndex < 0 || nextIndex >= flatImages.value.length) return
  activeImageIndex.value = nextIndex
}

function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer = null
  }, 1800)
}

async function shareActiveImage() {
  if (!activeImage.value) return

  try {
    await navigator.clipboard.writeText(new URL(activeImage.value.image.src, window.location.href).href)
    showToast('链接已复制')
  } catch {
    showToast('复制失败')
  }
}

function authHeaders(contentType?: string) {
  return {
    'X-Access-Code': accessCode.value,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

function showOperation(message: string, kind: 'success' | 'error' = 'success') {
  operationMessage.value = message
  operationKind.value = kind
  if (operationTimer !== null) window.clearTimeout(operationTimer)
  operationTimer = window.setTimeout(() => {
    operationMessage.value = ''
    operationTimer = null
  }, 2800)
}

function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  showOperation('管理员登录成功')
}

function logout() {
  clearAdminAccess()
  accessCode.value = ''
  showOperation('已退出管理员')
}

function imageExtension(file: File) {
  const fromName = file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLocaleLowerCase()
  if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName
  const fromType: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  return fromType[file.type] || 'img'
}

function photoTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, '').trim() || '未命名照片'
}

async function saveManifest(nextManifest: RawPhoto[]) {
  await apiRequest<{ count: number }>('/api/photos', {
    method: 'PUT',
    headers: authHeaders('application/json'),
    body: JSON.stringify(nextManifest),
  })
}

async function deleteImageObject(path: string) {
  return apiRequest(`/api/photos/image/${encodePath(path)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}

async function uploadPhotos(files: File[]) {
  const images = files.filter((file) => file.type.startsWith('image/'))
  if (!images.length || isUploading.value || operationBusy.value) return
  if (!isAuthenticated.value) {
    showLogin.value = true
    return
  }

  isUploading.value = true
  operationBusy.value = true
  const uploadedPaths: string[] = []

  try {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const dateLabel = `${year}.${month}`
    const additions: RawPhoto[] = []

    for (const file of images) {
      const path = `${year}/${month}/${crypto.randomUUID()}.${imageExtension(file)}`
      await apiRequest(`/api/photos/image/${encodePath(path)}`, {
        method: 'PUT',
        headers: authHeaders(file.type || 'application/octet-stream'),
        body: file,
      })
      uploadedPaths.push(path)
      additions.push({
        title: photoTitle(file),
        date: dateLabel,
        description: '',
        images: [{ img: path }],
      })
    }

    const nextManifest = [...manifest.value, ...additions]
    await saveManifest(nextManifest)
    await applyManifest(nextManifest)
    showOperation(`已上传 ${additions.length} 张照片`)
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map(deleteImageObject))
    showOperation(error instanceof Error ? error.message : '照片上传失败', 'error')
  } finally {
    isUploading.value = false
    operationBusy.value = false
  }
}

function handleUploadInput(event: Event) {
  const input = event.target as HTMLInputElement
  uploadPhotos(Array.from(input.files || []))
  input.value = ''
}

function handleDragEnter() {
  dragDepth.value += 1
  isDragging.value = true
}

function handleDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) isDragging.value = false
}

function handleDrop(event: DragEvent) {
  dragDepth.value = 0
  isDragging.value = false
  if (!isAuthenticated.value) {
    showLogin.value = true
    return
  }
  uploadPhotos(Array.from(event.dataTransfer?.files || []))
}

async function movePhoto(index: number, direction: -1 | 1) {
  const target = index + direction
  if (index < 0 || target < 0 || target >= manifest.value.length || operationBusy.value) return
  operationBusy.value = true

  try {
    const nextManifest = [...manifest.value]
    const [moved] = nextManifest.splice(index, 1)
    nextManifest.splice(target, 0, moved)
    await saveManifest(nextManifest)
    await applyManifest(nextManifest)
    showOperation('照片顺序已更新')
  } catch (error) {
    showOperation(error instanceof Error ? error.message : '排序失败', 'error')
  } finally {
    operationBusy.value = false
  }
}

function openEditPhoto(index: number) {
  const photo = manifest.value[index]
  if (!photo) return
  editingIndex.value = index
  editForm.title = photo.title || ''
  editForm.date = photo.date || ''
  editForm.description = photo.description || ''
  editError.value = ''
  document.documentElement.style.overflow = 'hidden'
}

function closeEditPhoto() {
  if (operationBusy.value) return
  editingIndex.value = -1
  if (!activeImage.value) document.documentElement.style.removeProperty('overflow')
}

async function savePhotoDetails() {
  const index = editingIndex.value
  const current = manifest.value[index]
  if (!current || operationBusy.value) return
  operationBusy.value = true
  editError.value = ''

  try {
    const nextManifest = [...manifest.value]
    nextManifest[index] = {
      ...current,
      title: editForm.title || undefined,
      date: editForm.date || undefined,
      description: editForm.description || undefined,
    }
    await saveManifest(nextManifest)
    await applyManifest(nextManifest)
    editingIndex.value = -1
    document.documentElement.style.removeProperty('overflow')
    showOperation('照片信息已保存')
  } catch (error) {
    editError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    operationBusy.value = false
  }
}

async function deletePhoto(index: number) {
  const photo = manifest.value[index]
  if (!photo || operationBusy.value) return
  if (!window.confirm(`确定删除“${photo.title || '这张照片'}”吗？`)) return
  operationBusy.value = true
  closeLightbox()

  try {
    const nextManifest = manifest.value.filter((_, itemIndex) => itemIndex !== index)
    await saveManifest(nextManifest)
    await applyManifest(nextManifest)

    const remainingPaths = new Set(nextManifest.flatMap((item) => (
      (item.images || []).map((image) => image.img?.trim()).filter(Boolean)
    )))
    const removedPaths = (photo.images || [])
      .map((image) => image.img?.trim())
      .filter((path): path is string => Boolean(path) && !remainingPaths.has(path))
    const cleanup = await Promise.allSettled(removedPaths.map(deleteImageObject))
    const cleanupFailed = cleanup.some((result) => result.status === 'rejected')
    showOperation(cleanupFailed ? '照片已移出相册，原图清理失败' : '照片已删除', cleanupFailed ? 'error' : 'success')
  } catch (error) {
    showOperation(error instanceof Error ? error.message : '删除失败', 'error')
  } finally {
    operationBusy.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (editingIndex.value >= 0 && event.key === 'Escape') {
    closeEditPhoto()
    return
  }
  if (!activeImage.value) return
  if (event.key === 'Escape') closeLightbox()
  if (event.key === 'ArrowLeft') moveLightbox(-1)
  if (event.key === 'ArrowRight') moveLightbox(1)
}

const pageBarVisible = ref(false)
const pageBarShown = ref(false)
const pageBarLeft = ref(0)
const pageBarThumbH = ref(0)
const pageBarThumbY = ref(0)
const pageBarDragging = ref(false)
let pageBarTrackH = 0
let pageBarFrame: number | null = null
let pageBarDragStartY = 0
let pageBarDragStartScroll = 0

function updatePageBar() {
  const doc = document.documentElement
  const viewportH = window.innerHeight
  const scrollH = doc.scrollHeight
  const masonry = masonryRoot.value
  if (!masonry || scrollH <= viewportH + 40) {
    pageBarVisible.value = false
    return
  }
  const masonryRect = masonry.getBoundingClientRect()
  pageBarLeft.value = Math.round(Math.min(masonryRect.right + 6, window.innerWidth - 16))
  // 与样式里 height: min(420px, 60vh) 保持一致
  pageBarTrackH = Math.min(420, viewportH * 0.6)
  // 第一行照片滚过轨道顶端后才慢慢显现
  pageBarShown.value = masonryRect.top < (viewportH - pageBarTrackH) / 2
  const thumbH = Math.max(36, pageBarTrackH * (viewportH / scrollH))
  const maxScroll = scrollH - viewportH
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop) / maxScroll)) : 0
  pageBarThumbH.value = Math.round(thumbH)
  pageBarThumbY.value = Math.round((pageBarTrackH - thumbH) * progress)
  pageBarVisible.value = true
}

function schedulePageBar() {
  if (pageBarFrame !== null) return
  pageBarFrame = requestAnimationFrame(() => {
    pageBarFrame = null
    updatePageBar()
  })
}

function handleThumbDown(event: PointerEvent) {
  pageBarDragging.value = true
  pageBarDragStartY = event.clientY
  pageBarDragStartScroll = window.scrollY || document.documentElement.scrollTop
  window.addEventListener('pointermove', handleThumbMove)
  window.addEventListener('pointerup', handleThumbUp)
  window.addEventListener('pointercancel', handleThumbUp)
}

function handleThumbMove(event: PointerEvent) {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const trackRange = pageBarTrackH - pageBarThumbH.value
  if (trackRange <= 0 || maxScroll <= 0) return
  const delta = (event.clientY - pageBarDragStartY) * (maxScroll / trackRange)
  window.scrollTo(0, pageBarDragStartScroll + delta)
}

function handleThumbUp() {
  pageBarDragging.value = false
  window.removeEventListener('pointermove', handleThumbMove)
  window.removeEventListener('pointerup', handleThumbUp)
  window.removeEventListener('pointercancel', handleThumbUp)
}

function handleTrackDown(event: PointerEvent) {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const trackRange = pageBarTrackH - pageBarThumbH.value
  if (trackRange <= 0 || maxScroll <= 0) return
  const trackTop = (window.innerHeight - pageBarTrackH) / 2
  const progress = Math.min(1, Math.max(0, (event.clientY - trackTop - pageBarThumbH.value / 2) / trackRange))
  window.scrollTo(0, progress * maxScroll)
}

onMounted(async () => {
  isMounted.value = true
  masonryObserver = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width || 0
    if (Math.abs(width - observedMasonryWidth) < 0.5) return
    observedMasonryWidth = width
    scheduleMasonryLayout()
  })
  loadPhotos()
  window.addEventListener('scroll', schedulePageBar, { passive: true })
  window.addEventListener('resize', schedulePageBar)
  schedulePageBar()
  accessCode.value = await restoreAdminAccess()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  abortController?.abort()
  masonryObserver?.disconnect()
  if (masonryFrame !== null) cancelAnimationFrame(masonryFrame)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', schedulePageBar)
  window.removeEventListener('resize', schedulePageBar)
  if (pageBarFrame !== null) cancelAnimationFrame(pageBarFrame)
  pendingMasonryTiles.clear()
  handleThumbUp()
  document.documentElement.style.removeProperty('overflow')
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  if (operationTimer !== null) window.clearTimeout(operationTimer)
})
</script>

<style scoped>
.photoGallery {
  position: relative;
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
}

.photoGalleryMeta {
  min-height: 98px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.photoGalleryMeta p,
.photoGalleryStatus > span {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.photoGalleryMeta h2 {
  margin: 5px 0 0;
  font-size: 25px;
  font-weight: 600;
  line-height: 32px;
}

.photoGalleryStatus {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 7px;
}

.photoGalleryStatus > span { margin-right: 5px; }
.photoFileInput { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.photoGalleryStatus button,
.photoLightboxActions button,
.photoLightboxActions a,
.photoLightboxNav {
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: inherit;
  background: var(--item_bg_color);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.photoGalleryStatus button.photoCommandButton {
  width: auto;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.photoAuthButton.is-authenticated { border-color: rgba(90, 160, 118, 0.4); }

.photoGalleryStatus button:hover,
.photoLightboxActions button:hover,
.photoLightboxActions a:hover,
.photoLightboxNav:hover {
  background: var(--item_hover_color);
  transform: translateY(-1px);
}

.photoGalleryStatus button:active,
.photoLightboxActions button:active,
.photoLightboxActions a:active,
.photoLightboxNav:active {
  transform: scale(0.96);
}

.photoGalleryStatus button:disabled,
.photoLightboxNav:disabled {
  opacity: 0.25;
  pointer-events: none;
}

.photoMasonry {
  padding-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-flow: row;
  grid-auto-rows: 1px;
  gap: 4px;
}

.photoScrollbar {
  position: fixed;
  top: 50%;
  height: min(420px, 60vh);
  width: 8px;
  z-index: 60;
  border-radius: 999px;
  background: rgba(37, 42, 50, 0.1);
  transform: translateY(-50%);
  touch-action: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
}

.photoScrollbar.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.photoScrollbarThumb {
  width: 100%;
  border-radius: 999px;
  background: rgba(37, 42, 50, 0.38);
  transition: background-color 0.2s ease;
}

.photoScrollbarThumb:hover,
.photoScrollbarThumb.is-dragging {
  background: rgba(37, 42, 50, 0.56);
}

[data-theme='Dark'] .photoScrollbar {
  background: rgba(255, 255, 255, 0.08);
}

[data-theme='Dark'] .photoScrollbarThumb {
  background: rgba(255, 255, 255, 0.3);
}

[data-theme='Dark'] .photoScrollbarThumb:hover,
[data-theme='Dark'] .photoScrollbarThumb.is-dragging {
  background: rgba(255, 255, 255, 0.46);
}


.photoSkeletonGrid {
  padding-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-flow: row;
  grid-auto-rows: 60px;
  gap: 4px;
}

.photoTile {
  position: relative;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  display: block;
  grid-row-end: span 220;
  background: var(--module_dock_inactive_bg);
}

.photoTile.has-entry-animation {
  animation: photoReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--photo-index) * 45ms);
}

.photoTile > button {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  display: block;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.photoNotice {
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

.photoNotice.is-error { color: #b14646; }

.photoAdminActions {
  position: absolute;
  right: 7px;
  bottom: 7px;
  z-index: 3;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  display: flex;
  gap: 2px;
  color: #f7f7f8;
  background: rgba(24, 26, 31, 0.82);
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.photoTile:hover .photoAdminActions,
.photoAdminActions:focus-within { opacity: 1; transform: translateY(0); }

.photoAdminActions button {
  width: 31px;
  height: 31px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.photoAdminActions button:hover { background: rgba(255, 255, 255, 0.14); }
.photoAdminActions button:disabled { opacity: 0.25; pointer-events: none; }
.photoAdminActions button.is-danger:hover { color: #ff9b9b; }

.photoDropOverlay {
  position: absolute;
  inset: 18px 0 70px;
  z-index: 8;
  border: 1px dashed var(--module_dock_active_border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: color-mix(in srgb, var(--item_bg_color) 90%, rgba(20, 21, 24, 0.68));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  font-size: 11px;
  pointer-events: none;
}

.photoModalBackdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--weather_dialog_backdrop);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.photoEditModal {
  width: min(480px, 100%);
  padding: 20px;
  border: 1px solid var(--weather_dialog_border);
  border-radius: 8px;
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_bg);
  box-shadow: 0 24px 70px -34px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset);
}

.photoEditModal header {
  min-height: 56px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--weather_dialog_line);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.photoEditModal header p { margin: 0; font-size: 9px; font-weight: 600; line-height: 13px; opacity: 0.5; }
.photoEditModal h3 { margin: 3px 0 0; font-size: 18px; line-height: 24px; }
.photoEditModal header button {
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
.photoEditModal header button:hover { border-color: var(--weather_dialog_line); background: var(--weather_dialog_control_hover); }
.photoEditModal > label { margin: 12px 0 7px; display: block; color: var(--weather_dialog_muted); font-size: 9px; line-height: 13px; }
.photoEditModal > input,
.photoEditModal > textarea {
  width: 100%;
  border: 1px solid var(--weather_dialog_line_strong);
  border-radius: 6px;
  outline: 0;
  color: inherit;
  background: var(--weather_dialog_control_bg);
  font: inherit;
  font-size: 11px;
}
.photoEditModal > input { height: 42px; padding: 0 11px; }
.photoEditModal > textarea { padding: 11px; resize: vertical; line-height: 18px; }
.photoEditModal > input:focus,
.photoEditModal > textarea:focus { border-color: var(--weather_dialog_focus); }
.photoFormError { margin: 9px 0 0; color: #b14646; font-size: 9px; line-height: 14px; }
.photoPrimaryButton {
  width: 100%;
  min-height: 40px;
  margin-top: 18px;
  border: 1px solid var(--weather_dialog_active_bg);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--weather_dialog_active_text);
  background: var(--weather_dialog_active_bg);
  font-size: 10px;
  cursor: pointer;
}
.photoPrimaryButton:disabled { opacity: 0.5; }

.photo-modal-enter-active,
.photo-modal-leave-active { transition: opacity 0.22s ease; }
.photo-modal-enter-active .photoEditModal,
.photo-modal-leave-active .photoEditModal { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease; }
.photo-modal-enter-from,
.photo-modal-leave-to { opacity: 0; }
.photo-modal-enter-from .photoEditModal,
.photo-modal-leave-to .photoEditModal { opacity: 0; transform: translateY(10px) scale(0.98); }

.photoMedia {
  position: relative;
  height: 100%;
  display: block;
  overflow: hidden;
  background: var(--module_dock_inactive_bg);
}

.photoMedia img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: filter 0.3s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  -webkit-user-drag: none;
}

.photoTile:hover img {
  filter: brightness(0.78);
  transform: scale(1.015);
}

.photoTileSkeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, var(--module_dock_inactive_bg) 20%, var(--item_hover_color) 45%, var(--module_dock_inactive_bg) 70%);
  background-size: 220% 100%;
}

.photoTileSkeleton.is-animated {
  animation: photoShimmer 1.4s ease-in-out infinite;
}

.photoSkeletonGrid > span {
  min-width: 0;
  grid-row: span 4;
  background: linear-gradient(100deg, var(--module_dock_inactive_bg) 20%, var(--item_hover_color) 45%, var(--module_dock_inactive_bg) 70%);
  background-size: 220% 100%;
  animation: photoShimmer 1.4s ease-in-out infinite;
}

.photoSkeletonGrid .shape-2 { grid-row: span 3; }
.photoSkeletonGrid .shape-3 { grid-row: span 5; }

.workspaceState {
  min-height: 360px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.workspaceState h3 {
  margin-top: 14px;
  font-size: 18px;
  line-height: 25px;
}

.workspaceState p {
  max-width: 42ch;
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 17px;
  opacity: 0.54;
}

.workspaceState button {
  min-height: 36px;
  margin-top: 18px;
  padding: 0 14px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font-size: 10px;
  cursor: pointer;
}

.photoLightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 64px;
  grid-template-rows: minmax(0, 1fr) 72px;
  align-items: center;
  color: #f7f7f8;
  background: rgba(18, 19, 22, 0.97);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  cursor: zoom-out;
}

.photoLightboxActions button,
.photoLightboxActions a {
  border-color: transparent;
  color: rgba(247, 247, 248, 0.82);
  background: transparent;
  box-shadow: none;
}

.photoLightboxActions button:hover,
.photoLightboxActions a:hover {
  border-color: transparent;
  color: #f7f7f8;
  background: rgba(255, 255, 255, 0.12);
}

.photoLightboxActions button:focus-visible,
.photoLightboxActions a:focus-visible,
.photoLightboxNav:focus-visible {
  outline: 2px solid #f7f7f8;
  outline-offset: 3px;
}

.photoLightboxNav {
  border-color: rgba(255, 255, 255, 0.28);
  color: #f7f7f8;
  background: rgba(255, 255, 255, 0.12);
}

.photoLightboxNav {
  justify-self: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.photoLightboxNav.is-prev { grid-column: 1; grid-row: 1; }
.photoLightboxNav.is-next { grid-column: 3; grid-row: 1; }

.photoLightboxFigure {
  margin: 0;
  padding: 20px 12px;
  min-width: 0;
  min-height: 0;
  grid-column: 2;
  grid-row: 1;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photoLightboxFigure img {
  max-width: 100%;
  max-height: calc(100dvh - 112px);
  border-radius: 8px;
  display: block;
  object-fit: contain;
  box-shadow: 0 24px 70px -34px rgba(0, 0, 0, 0.9);
  cursor: default;
  user-select: none;
  -webkit-user-drag: none;
}

.photoLightboxActions {
  width: max-content;
  min-height: 48px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  grid-column: 1 / -1;
  grid-row: 2;
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(30, 31, 35, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.photoToast {
  position: fixed;
  bottom: 86px;
  left: 50%;
  padding: 9px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(30, 31, 35, 0.92);
  font-size: 10px;
  transform: translateX(-50%);
}

.photo-lightbox-enter-active,
.photo-lightbox-leave-active,
.photo-toast-enter-active,
.photo-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.photo-lightbox-enter-from,
.photo-lightbox-leave-to { opacity: 0; }
.photo-toast-enter-from,
.photo-toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }

@keyframes photoReveal {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes photoShimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

@media (max-width: 800px) {
  .photoGallery {
    width: calc(100% - 18px);
    margin: 0 9px;
  }
}

@media (max-width: 1000px) {
  .photoMasonry,
  .photoSkeletonGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .photoGalleryMeta {
    align-items: flex-start;
    flex-direction: column;
  }

  .photoGalleryStatus {
    width: 100%;
    justify-content: flex-start;
  }

  .photoGalleryStatus > span { display: none; }
  .photoGalleryStatus .photoAuthButton { margin-left: auto; }
  .photoGalleryStatus button.photoCommandButton { width: 38px; padding: 0; }
  .photoGalleryStatus button.photoCommandButton span { display: none; }
  .photoAdminActions { right: 5px; bottom: 5px; opacity: 1; transform: none; }
  .photoAdminActions button { width: 29px; height: 29px; }
  .photoModalBackdrop { padding: 10px; }

  .photoMasonry,
  .photoSkeletonGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px;
  }

  .photoLightbox {
    grid-template-columns: 48px minmax(0, 1fr) 48px;
  }

  .photoLightboxNav {
    width: 38px;
    height: 38px;
  }
}

@media (max-width: 380px) {
  .photoMasonry,
  .photoSkeletonGrid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .photoTile,
  .photoTileSkeleton,
  .photoSkeletonGrid > span {
    animation: none;
  }

  .photoTile,
  .photoMedia img,
  .photoGalleryStatus button,
  .photoLightboxActions button,
  .photoLightboxActions a,
  .photoLightboxNav {
    transition: none;
  }

  .photoAdminActions,
  .photo-modal-enter-active,
  .photo-modal-leave-active,
  .photo-modal-enter-active .photoEditModal,
  .photo-modal-leave-active .photoEditModal {
    transition: none;
  }
}
</style>
