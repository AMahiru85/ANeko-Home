const CODE_BLOCK_SELECTOR = '.blogProse pre'
const resetTimers = new WeakMap()

function createSvg(className, children) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', className)
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')

  children.forEach(({ tag, attributes }) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
    svg.append(element)
  })

  return svg
}

function createCopyButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'blogCodeCopyButton'
  button.title = '复制代码'
  button.setAttribute('aria-label', '复制代码')
  button.dataset.state = 'idle'

  button.append(
    createSvg('blogCodeCopyIcon', [
      { tag: 'rect', attributes: { x: '9', y: '9', width: '11', height: '11', rx: '2' } },
      { tag: 'path', attributes: { d: 'M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3' } },
    ]),
    createSvg('blogCodeSuccessIcon', [
      { tag: 'path', attributes: { d: 'm5 12 4 4L19 6' } },
    ]),
  )

  return button
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    let timeoutId

    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('Clipboard timed out')), 800)
        }),
      ])
      return
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }

  throw new Error('Clipboard is unavailable')
}

function setButtonState(button, state) {
  const labels = {
    copied: '已复制',
    error: '复制失败',
    idle: '复制代码',
  }
  const label = labels[state] || labels.idle

  button.dataset.state = state
  button.title = label
  button.setAttribute('aria-label', label)

  const existingTimer = resetTimers.get(button)
  if (existingTimer) window.clearTimeout(existingTimer)

  if (state !== 'idle') {
    const timer = window.setTimeout(() => {
      button.dataset.state = 'idle'
      button.title = labels.idle
      button.setAttribute('aria-label', labels.idle)
      resetTimers.delete(button)
    }, 1600)
    resetTimers.set(button, timer)
  }
}

function enhanceCodeBlock(pre) {
  if (pre.dataset.codeEnhanced === 'true') return

  const code = pre.querySelector('code')
  if (!code) return

  const wrapper = document.createElement('div')
  wrapper.className = 'blogCodeBlock'
  pre.before(wrapper)
  wrapper.append(pre)

  const button = createCopyButton()
  button.addEventListener('click', async () => {
    if (button.dataset.state === 'copying') return

    button.dataset.state = 'copying'
    button.disabled = true

    try {
      await copyText(code.textContent.replace(/\n$/, ''))
      setButtonState(button, 'copied')
    } catch {
      setButtonState(button, 'error')
    } finally {
      button.disabled = false
    }
  })

  wrapper.append(button)
  pre.dataset.codeEnhanced = 'true'
}

function initializeCodeBlocks() {
  document.querySelectorAll(CODE_BLOCK_SELECTOR).forEach(enhanceCodeBlock)
}

document.addEventListener('astro:page-load', initializeCodeBlocks)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCodeBlocks, { once: true })
} else {
  initializeCodeBlocks()
}
