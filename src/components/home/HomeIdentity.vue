<template>
  <div class="homeIdentity">
    <section class="identityCard" aria-labelledby="identity-name">
      <div class="identityEyebrow"><span class="identityStatus" aria-hidden="true"></span>DIGITAL IDENTITY <span class="identityIndex">01 / PROFILE</span></div>

      <div class="identityPortrait">
        <img src="/static/img/logo.jpg" :alt="`${content.profile.displayName} 的头像`" width="88" height="88" decoding="async" />
        <span class="portraitNote">A little corner of the internet.</span>
      </div>

      <p class="identityGreeting">{{ content.profile.greeting }}</p>
      <h1 id="identity-name" class="identityName">{{ content.profile.displayName }}<span aria-hidden="true">.</span></h1>
      <p v-if="content.profile.role" class="identityRole">{{ content.profile.role }}</p>
      <p v-if="content.profile.introduction" class="identityIntroduction">{{ content.profile.introduction }}</p>

      <div class="identityTags" v-if="content.profile.tags.length">
        <span v-for="tag in content.profile.tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="identitySocials" aria-label="社交与联系">
        <a href="/blog/" data-astro-reload><BookOpen :size="17" aria-hidden="true" /><span>Blog</span><ArrowUpRight :size="13" class="socialArrow" aria-hidden="true" /></a>
        <a :href="`https://github.com/${content.github.username}`" target="_blank" rel="noreferrer"><GitFork :size="17" aria-hidden="true" /><span>GitHub</span><ArrowUpRight :size="13" class="socialArrow" aria-hidden="true" /></a>
        <a href="/mail/" data-astro-reload><Mail :size="17" aria-hidden="true" /><span>Mail</span><ArrowUpRight :size="13" class="socialArrow" aria-hidden="true" /></a>
      </div>

      <div class="identityQrLinks" aria-label="社交二维码">
        <span>ELSEWHERE</span>
        <button type="button" @click="openPopup('/static/img/qq.jpg', 'QQ', $event)">QQ</button>
        <span class="qrSeparator" aria-hidden="true">/</span>
        <button type="button" @click="openPopup('/static/img/bilibili.jpg', 'Bilibili', $event)">Bilibili</button>
        <span class="qrSeparator" aria-hidden="true">/</span>
        <button type="button" @click="openPopup('/static/img/dy.jpg', '抖音', $event)">抖音</button>
      </div>

      <dl class="identityDetails" v-if="content.profile.location || content.profile.education">
        <div v-if="content.profile.location"><dt><MapPin :size="15" aria-hidden="true" /> BASED IN</dt><dd>{{ content.profile.location }}</dd></div>
        <div v-if="content.profile.education"><dt><GraduationCap :size="16" aria-hidden="true" /> EDUCATION</dt><dd>{{ content.profile.education }}</dd></div>
      </dl>
    </section>

    <section class="identityTerminal" aria-labelledby="terminal-title">
      <div class="terminalTopbar">
        <div class="terminalLights" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2 id="terminal-title"><Terminal :size="13" aria-hidden="true" /> ANeko Terminal</h2>
        <span class="terminalTopbarHint">~/home</span>
      </div>
      <div ref="terminalOutput" class="terminalOutput" role="log" aria-live="polite" aria-relevant="additions" aria-label="终端输出">
        <div v-if="showWelcome" class="terminalWelcome">
          <p><span class="terminalAccent">{{ content.profile.displayName }}</span> / personal space</p>
          <p>你好，欢迎来到我的数字空间。</p>
          <p>输入 <span class="terminalAccent">help</span> 探索，或用 <span class="terminalAccent">timeline</span> 查看更新记录。</p>
        </div>
        <div v-for="entry in terminalEntries" :key="entry.id" class="terminalEntry">
          <p class="terminalCommand"><span class="terminalPrompt" aria-hidden="true">❯</span> {{ entry.command }}</p>
          <p class="terminalResponse" :class="{ 'terminalError': entry.error }">{{ entry.output }}</p>
          <a v-if="entry.link" class="terminalResultLink" :href="entry.link.href" data-astro-reload>{{ entry.link.label }} <ArrowUpRight :size="13" aria-hidden="true" /></a>
        </div>
      </div>
      <form class="terminalInputRow" @submit.prevent="submitCommand">
        <label for="home-terminal-input" class="terminalPrompt"><span class="visuallyHidden">终端命令</span><span aria-hidden="true">❯</span></label>
        <input id="home-terminal-input" ref="terminalInput" v-model="commandInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="输入 help …" aria-label="终端命令，输入 help 查看可用命令" @keydown="handleCommandKeydown" />
        <button type="submit" aria-label="执行命令"><CornerDownLeft :size="16" aria-hidden="true" /></button>
      </form>
      <div class="terminalFooter"><span><span class="terminalStatus" aria-hidden="true"></span> INTERACTIVE PROFILE</span><button type="button" @click="runCommand('timeline')"><History :size="12" aria-hidden="true" /> 更新记录</button></div>
    </section>

    <div v-if="popupImage" class="identityPopup" role="dialog" aria-modal="true" :aria-label="`${popupName} 二维码`" @keydown="handlePopupKeydown">
      <PopupModal :image-url="popupImage" @close="closePopup" />
      <button ref="popupClose" class="popupClose" type="button" @click="closePopup" :aria-label="`关闭 ${popupName} 二维码`"><X :size="22" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ArrowUpRight, BookOpen, CornerDownLeft, GitFork, GraduationCap, History, Mail, MapPin, Terminal, X } from '@lucide/vue'
import PopupModal from '../PopupModal.vue'
import type { SiteContent } from '../../utils/site-content'

const props = defineProps<{ content: SiteContent }>()
const emit = defineEmits<{ navigate: [section: 'identity' | 'workspace' | 'projects' | 'stack'] }>()

interface TerminalEntry {
  id: number
  command: string
  output: string
  error?: boolean
  link?: { href: string; label: string }
}

const commandInput = ref('')
const showWelcome = ref(true)
const terminalEntries = ref<TerminalEntry[]>([])
const terminalOutput = ref<HTMLDivElement | null>(null)
const terminalInput = ref<HTMLInputElement | null>(null)
const commandHistory = ref<string[]>([])
let historyPosition = 0
let commandSequence = 0
const popupImage = ref('')
const popupName = ref('')
const popupClose = ref<HTMLButtonElement | null>(null)
let popupTrigger: HTMLElement | null = null

async function openPopup(image: string, name: string, event: MouseEvent) {
  popupTrigger = event.currentTarget as HTMLElement
  popupImage.value = image
  popupName.value = name
  await nextTick()
  popupClose.value?.focus()
}

function closePopup() {
  popupImage.value = ''
  popupTrigger?.focus()
}

function handlePopupKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePopup()
  if (event.key === 'Tab') {
    event.preventDefault()
    popupClose.value?.focus()
  }
}

async function runCommand(rawCommand: string) {
  const command = rawCommand.trim()
  if (!command) return
  const normalized = command.toLowerCase()
  commandHistory.value.push(command)
  if (commandHistory.value.length > 40) commandHistory.value.shift()
  historyPosition = commandHistory.value.length
  let output = ''
  let error = false
  let link: TerminalEntry['link']

  switch (normalized) {
    case 'help':
      output = 'about      关于我\nworkspace  工作空间\nprojects   站点与项目\nstack      技术栈\ntimeline   更新记录\nblog       博客入口\nclear      清空输出'
      break
    case 'about':
      output = [props.content.profile.displayName, props.content.profile.role, props.content.profile.description].filter(Boolean).join('\n')
      break
    case 'workspace':
    case 'projects':
    case 'stack':
      output = `正在打开 ${normalized} …`
      emit('navigate', normalized)
      break
    case 'timeline': {
      const items = props.content.timeline.filter(item => item.enabled)
      output = items.length ? items.map(item => `${item.date}  ${item.content}`).join('\n\n') : '还没有更新记录。'
      break
    }
    case 'blog':
      output = '开发实践、技术笔记与日常记录。'
      link = { href: '/blog/', label: '进入博客' }
      break
    case 'clear':
      terminalEntries.value = []
      showWelcome.value = false
      return
    default:
      output = `未知命令：${command}\n输入 help 查看可用命令。`
      error = true
  }

  terminalEntries.value.push({ id: ++commandSequence, command, output, error, link })
  if (terminalEntries.value.length > 40) terminalEntries.value.shift()
  await nextTick()
  if (terminalOutput.value) terminalOutput.value.scrollTop = terminalOutput.value.scrollHeight
}

function submitCommand() {
  const command = commandInput.value
  commandInput.value = ''
  void runCommand(command)
}

function handleCommandKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  historyPosition = Math.min(commandHistory.value.length, Math.max(0, historyPosition + (event.key === 'ArrowUp' ? -1 : 1)))
  commandInput.value = commandHistory.value[historyPosition] ?? ''
}
</script>

<style scoped>
.homeIdentity { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .96fr); align-items: center; gap: clamp(40px, 6vw, 86px); color: var(--home-text); }
.homeIdentity *, .homeIdentity *::before, .homeIdentity *::after { box-sizing: border-box; }
.identityCard { min-width: 0; }
.identityEyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 30px; color: var(--home-muted); font-size: 10px; font-weight: 600; letter-spacing: 1.8px; }
.identityStatus, .terminalStatus { display: inline-block; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: var(--home-accent); }
.identityIndex { margin-left: auto; font-size: 9px; letter-spacing: 1px; opacity: .65; }
.identityPortrait { display: flex; align-items: center; gap: 17px; margin-bottom: 29px; }
.identityPortrait img { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; outline: 1px solid var(--home-border); outline-offset: 5px; }
.portraitNote { max-width: 130px; color: var(--home-muted); font-size: 11px; line-height: 1.7; }
.identityGreeting { margin: 0 0 7px; color: var(--home-muted); font-size: 18px; line-height: 1.4; }
.identityName { margin: 0 0 15px; font-size: clamp(48px, 5.4vw, 76px); font-weight: 650; letter-spacing: -4px; line-height: 1.05; overflow-wrap: anywhere; }
.identityName span { color: var(--home-accent); }
.identityRole { margin: 0 0 13px; font-size: 16px; line-height: 1.6; font-weight: 500; }
.identityIntroduction { max-width: 410px; margin: 0; color: var(--home-muted); font-size: 13px; line-height: 1.9; white-space: pre-line; }
.identityTags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
.identityTags span { border: 1px solid var(--home-border); border-radius: 5px; padding: 4px 8px; color: var(--home-muted); font-size: 10px; line-height: 1.4; }
.identitySocials { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 30px; }
.identitySocials a { display: inline-flex; align-items: center; gap: 8px; min-height: 39px; border: 1px solid var(--home-border); border-radius: 7px; padding: 0 11px; color: var(--home-text); background: var(--home-surface); text-decoration: none; font-size: 12px; transition: background .18s, border-color .18s; }
.identitySocials a:hover { background: var(--home-soft); border-color: var(--home-muted); }
.socialArrow { margin-left: 5px; color: var(--home-muted); }
.identityQrLinks { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 19px; color: var(--home-muted); }
.identityQrLinks > span:first-child { margin-right: 2px; font-size: 8px; letter-spacing: 1.6px; }
.identityQrLinks button { appearance: none; min-height: 28px; border: 0; padding: 2px 0; color: var(--home-muted); background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
.identityQrLinks button:hover { color: var(--home-text); }
.qrSeparator { font-size: 9px; opacity: .5; }
.identityDetails { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 30px 0 0; border-top: 1px solid var(--home-border); padding-top: 20px; }
.identityDetails dt { display: flex; align-items: center; gap: 6px; color: var(--home-muted); font-size: 8px; font-weight: 500; letter-spacing: 1.3px; }
.identityDetails dd { margin: 8px 0 0; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.identityTerminal { min-width: 0; overflow: hidden; border: 1px solid var(--home-border); border-radius: 12px; background: var(--home-surface); box-shadow: 0 12px 36px rgb(0 0 0 / 3%); font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace; }
.terminalTopbar { display: flex; align-items: center; gap: 16px; min-height: 47px; border-bottom: 1px solid var(--home-border); padding: 0 17px; background: var(--home-soft); }
.terminalLights { display: flex; gap: 5px; }
.terminalLights i { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--home-muted); opacity: .25; }
.terminalTopbar h2 { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--home-muted); font: inherit; font-size: 10px; font-weight: 500; }
.terminalTopbarHint { margin-left: auto; color: var(--home-muted); font-size: 9px; opacity: .7; }
.terminalOutput { height: 260px; overflow-y: auto; overscroll-behavior: contain; padding: 24px 22px 10px; color: var(--home-muted); font-size: 11px; line-height: 1.85; scrollbar-width: thin; scrollbar-color: var(--home-border) transparent; }
.terminalWelcome p { margin: 0 0 7px; }
.terminalWelcome p:first-child { margin-bottom: 18px; }
.terminalAccent { color: var(--home-text); }
.terminalEntry { margin-top: 17px; }
.terminalCommand { margin: 0 0 5px; color: var(--home-text); overflow-wrap: anywhere; }
.terminalPrompt { color: var(--home-accent); font-size: 15px; font-weight: 600; }
.terminalCommand .terminalPrompt { margin-right: 6px; }
.terminalResponse { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.terminalError { color: var(--home-text); }
.terminalResultLink { display: inline-flex; align-items: center; gap: 5px; margin-top: 7px; color: var(--home-accent); text-decoration: underline; text-underline-offset: 3px; }
.terminalInputRow { display: flex; align-items: center; gap: 11px; margin: 0; padding: 15px 22px 20px; }
.terminalInputRow input { min-width: 0; width: 100%; border: 0; outline: 0; padding: 2px 0; color: var(--home-text); background: transparent; font: inherit; font-size: 11px; line-height: 1.5; }
.terminalInputRow input::placeholder { color: var(--home-muted); opacity: .6; }
.terminalInputRow button { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border: 1px solid var(--home-border); border-radius: 5px; padding: 0; color: var(--home-muted); background: var(--home-soft); cursor: pointer; }
.terminalInputRow:focus-within { background: var(--home-soft); }
.terminalFooter { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 37px; border-top: 1px solid var(--home-border); padding: 0 17px; color: var(--home-muted); font-size: 8px; letter-spacing: .6px; }
.terminalFooter > span { display: inline-flex; align-items: center; gap: 7px; }
.terminalStatus { width: 5px; height: 5px; }
.terminalFooter button { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; border: 0; padding: 0; color: var(--home-muted); background: transparent; font: inherit; font-size: 9px; cursor: pointer; }
.terminalFooter button:hover { color: var(--home-text); }
.homeIdentity a:focus-visible, .homeIdentity button:focus-visible { outline: 2px solid var(--home-accent); outline-offset: 4px; }
.visuallyHidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.identityPopup :deep(.tc) { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 30px; background: rgb(0 0 0 / 65%); backdrop-filter: blur(8px); opacity: 1; visibility: visible; cursor: pointer; }
.identityPopup :deep(.tc-main) { display: flex; align-items: center; justify-content: center; max-width: 420px; max-height: calc(100dvh - 100px); border-radius: 12px; padding: 12px; background: #fff; transform: none; opacity: 1; cursor: default; }
.identityPopup :deep(.tc-img) { display: block; max-width: 100%; max-height: calc(100dvh - 124px); width: auto; height: auto; object-fit: contain; border-radius: 6px; }
.popupClose { position: fixed; top: 25px; right: 25px; z-index: 1001; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 1px solid rgb(255 255 255 / 25%); border-radius: 50%; color: #fff; background: rgb(0 0 0 / 25%); cursor: pointer; }
@media (max-width: 850px) { .homeIdentity { gap: 34px; } .identityName { font-size: 58px; } .terminalTopbarHint { display: none; } .terminalOutput { padding-right: 17px; padding-left: 17px; } .identityDetails { gap: 14px; } }
@media (max-width: 650px) { .homeIdentity { grid-template-columns: minmax(0, 1fr); gap: 36px; } .identityEyebrow { margin-bottom: 27px; } .identityName { font-size: clamp(52px, 14vw, 72px); } .identityPortrait { margin-bottom: 26px; } .identityIntroduction { max-width: none; } .identityTerminal { border-radius: 10px; } .terminalOutput { height: 235px; } .terminalTopbarHint { display: inline; } .identityDetails { margin-top: 25px; } }
@media (prefers-reduced-motion: reduce) { .identitySocials a { transition: none; } }
</style>
