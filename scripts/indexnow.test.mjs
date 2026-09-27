import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Run without an Astro build, Cloudflare bindings, credentials, or network access.
// Only the real IndexNow modules and their HTTP adapters are loaded into the VM.
const compiled = new Map()
const testKey = 'offline-indexnow-key-12345678'
const origin = 'https://www.aneko.ink'

function loadTs(path, dependencies, globals) {
  if (!compiled.has(path)) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    compiled.set(path, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)
  }
  const exports = {}
  vm.runInNewContext(compiled.get(path), {
    exports, URL, Request, Response, Headers, AbortController, DOMException,
    TextDecoder, Error, setTimeout, clearTimeout,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    },
    ...globals,
  }, { filename: path })
  return exports
}

function setup(options = {}) {
  const calls = []
  const logs = []
  const postReads = []
  const key = options.key ?? testKey
  const cloudflare = { getBindings: () => ({}), getIndexNowKey: () => key.trim() }
  const globals = {
    fetch: async (url, init) => {
      const call = { url: String(url), init }
      calls.push(call)
      if (options.fetch) return options.fetch(call, calls.length)
      return new Response(init.method === 'GET' ? key.trim() : '', { status: 200 })
    },
    console: { error: (...args) => logs.push(args) },
    ...options.globals,
  }
  const posts = {
    POSTS_PER_PAGE: 6,
    tagToSlug: (tag) => tag.toLowerCase().replaceAll(' ', '-'),
    getStoredPostIndex: async (requestOptions) => {
      postReads.push(requestOptions)
      if (options.indexError) throw options.indexError
      return options.posts ?? []
    },
  }
  const indexnow = loadTs('src/utils/indexnow.ts', {
    './cloudflare': cloudflare, './posts': posts, './runtime-config': { SITE_ORIGIN: origin },
  }, globals)
  const http = loadTs('src/utils/http.ts', {}, globals)
  const admin = loadTs('src/pages/api/admin/indexnow.ts', {
    '../../../utils/auth': { verifyAdminRequest: async () => options.authenticated !== false },
    '../../../utils/cloudflare': cloudflare,
    '../../../utils/http': http,
    '../../../utils/indexnow': indexnow,
    '../../../utils/posts': posts,
  }, globals)
  const keyRoute = loadTs('src/pages/[key].txt.ts', {
    '../utils/cloudflare': cloudflare, '../utils/indexnow': indexnow,
  }, globals)
  return {
    indexnow, keyRoute, calls, logs, postReads,
    submit: () => admin.POST({ request: new Request(`${origin}/api/admin/indexnow`, { method: 'POST' }) }),
  }
}

test('invalid configuration is rejected consistently by submission and public key route', async () => {
  for (const key of ['', 'short', 'invalid_key_123', 'a'.repeat(129)]) {
    const harness = setup({ key })
    await assert.rejects(harness.indexnow.submitIndexNow(['/']), { kind: 'configuration' })
    assert.equal((await harness.keyRoute.GET({ params: { key } })).status, 404)
    assert.equal(harness.calls.length, 0)
  }
  const harness = setup({ key: ` ${testKey} ` })
  const response = await harness.keyRoute.GET({ params: { key: testKey } })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), testKey)
  assert.match(response.headers.get('Content-Type'), /text\/plain/)
  assert.equal((await harness.keyRoute.GET({ params: { key: 'unrelated-valid-key' } })).status, 404)
})

test('manual submission sends keyLocation to the provider without a self-fetch', async () => {
  const harness = setup()
  const response = await harness.submit()
  assert.equal(response.status, 200)
  const { success, data } = await response.json()
  assert.equal(success, true)
  assert.equal(data.status, 'accepted')
  assert.equal(data.accepted, 7)
  assert.equal(data.pending, 0)
  assert.equal(harness.calls.length, 2)
  assert.equal(harness.calls[0].url, 'https://api.indexnow.org/indexnow')
  assert.equal(harness.calls[1].url, 'https://www.bing.com/indexnow')
  assert.equal(harness.calls[0].init.method, 'POST')
  assert.equal(harness.calls[1].init.method, 'POST')
  assert.equal(harness.calls[0].init.redirect, 'manual')
  const body = JSON.parse(harness.calls[0].init.body)
  assert.deepEqual(JSON.parse(harness.calls[1].init.body), body)
  assert.equal(body.host, 'www.aneko.ink')
  assert.equal(body.keyLocation, `${origin}/${testKey}.txt`)
  assert.equal(body.key, testKey)
  assert.deepEqual({ ...harness.postReads[0] }, { refresh: true, allowStale: false })
})

test('202 means pending key verification from both providers', async () => {
  const harness = setup({ fetch: () => new Response('', { status: 202 }) })
  const response = await harness.submit()
  assert.equal(response.status, 202)
  const { data } = await response.json()
  assert.equal(data.status, 'pending')
  assert.equal(data.submitted, 7)
  assert.equal(data.pending, 7)
  assert.equal(data.accepted, 0)
  assert.equal(harness.calls.length, 2)
  assert.deepEqual(data.providerResults.map(({ provider, state }) => ({ provider, state })), [
    { provider: 'IndexNow', state: 'pending' },
    { provider: 'Bing', state: 'pending' },
  ])
})

test('URLs are normalized, deduplicated, and restricted to the canonical origin', async () => {
  const harness = setup()
  const result = await harness.indexnow.submitIndexNow([
    '/blog/#first', `${origin}/blog/#second`, 'https://WWW.ANEKO.INK:443/blog/',
    'https://other.example/', '//other.example/', 'http://www.aneko.ink/',
    'https://user:password@www.aneko.ink/', 'http://[invalid', '/blog/中文/',
  ])
  assert.equal(result.submitted, 2)
  assert.deepEqual(JSON.parse(harness.calls[0].init.body).urlList, [
    `${origin}/blog/`, `${origin}/blog/%E4%B8%AD%E6%96%87/`,
  ])
  const empty = await harness.indexnow.submitIndexNow(['https://other.example/'])
  assert.equal(empty.submitted, 0)
  assert.equal(empty.status, 'empty')
  assert.equal(harness.calls.length, 1)
})

test('drafts stay private; removed public articles and listing pages are notified', () => {
  const { indexnow } = setup()
  const published = Array.from({ length: 7 }, (_, index) => ({ slug: `post-${index}`, draft: false, tags: ['Public'] }))
  const draft = { slug: 'private', draft: true, tags: ['Secret'] }
  const paths = indexnow.allIndexNowPaths([...published, draft])
  assert.equal(paths.includes('/blog/private/'), false)
  assert.equal(paths.includes('/blog/tag/secret/'), false)
  assert.equal(paths.includes('/blog/page/2/'), true)
  assert.equal(paths.filter((path) => path === '/blog/tag/public/').length, 1)
  assert.equal(indexnow.blogIndexNowPaths('private', [], [draft]).length, 0)
  const deleted = indexnow.blogIndexNowPaths('post-0', published, published.slice(1))
  assert.equal(deleted.includes('/blog/post-0/'), true)
  assert.equal(deleted.includes('/blog/page/2/'), true)
  const hidden = indexnow.blogIndexNowPaths('post-0', published, [{ ...published[0], draft: true }])
  assert.equal(hidden.includes('/blog/post-0/'), true)
})

test('transient failures use the backup provider once, without repeating the primary', async (t) => {
  for (const failure of ['network', 503]) {
    await t.test(String(failure), async () => {
      const harness = setup({ fetch: (_call, count) => {
        if (count === 1 && failure === 'network') throw new Error(`upstream leaked ${testKey}`)
        return new Response('', { status: count === 1 ? failure : 200 })
      } })
      const result = await harness.indexnow.submitIndexNow(['/'])
      assert.equal(result.accepted, 1)
      assert.deepEqual(harness.calls.map((call) => call.url), [
        'https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow',
      ])
    })
  }
})

test('403 and 422 have safe Chinese diagnostics and never echo upstream content', async (t) => {
  for (const [status, routeStatus, message] of [[403, 502, /密钥验证失败/], [422, 422, /主机不匹配/]]) {
    await t.test(String(status), async () => {
      let canceled = false
      const harness = setup({ fetch: () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(`${testKey} ${'secret'.repeat(100_000)}`)) },
        cancel() { canceled = true },
      }), { status }) })
      const response = await harness.submit()
      assert.equal(response.status, routeStatus)
      const body = await response.text()
      assert.match(JSON.parse(body).error, message)
      assert.equal(body.includes(testKey), false)
      assert.equal(JSON.stringify(harness.logs).includes(testKey), false)
      assert.equal(canceled, true)
      assert.equal(harness.calls.length, 2)
    })
  }
})

test('429 and Retry-After stop immediately and preserve the provider delay', async (t) => {
  for (const [status, delay] of [[429, '86400'], [503, 'Wed, 01 Oct 2031 00:00:00 GMT'], [429, null]]) {
    await t.test(`${status} ${delay}`, async () => {
      const harness = setup({ fetch: () => new Response('', { status, headers: delay ? { 'Retry-After': delay } : {} }) })
      const response = await harness.submit()
      assert.equal(response.status, status)
      assert.equal(response.headers.get('Retry-After'), delay)
      assert.equal(harness.calls.length, 2)
      const { error, diagnostic } = await response.json()
      assert.match(error, status === 429 ? /过于频繁/ : /服务暂时异常/)
      assert.equal(diagnostic.upstreamStatus, status)
      assert.equal(diagnostic.providerResults.length, 2)
      assert.ok(diagnostic.providerResults.every(({ status: providerStatus }) => providerStatus === status))
    })
  }
})

test('manual submission reports partial success when one provider rate limits the request', async () => {
  const harness = setup({ fetch: ({ url }) => new Response('', {
    status: url === 'https://api.indexnow.org/indexnow' ? 429 : 200,
    headers: url === 'https://api.indexnow.org/indexnow' ? { 'Retry-After': '3600' } : {},
  }) })
  const response = await harness.submit()
  assert.equal(response.status, 200)
  const { data } = await response.json()
  assert.equal(data.submitted, 7)
  assert.equal(data.accepted, 7)
  assert.equal(data.pending, 0)
  assert.deepEqual(data.providerResults.map(({ provider, state, status }) => ({ provider, state, status })), [
    { provider: 'IndexNow', state: 'failed', status: 429 },
    { provider: 'Bing', state: 'accepted', status: 200 },
  ])
  assert.equal(data.providerResults[0].retryAfter, '3600')
  assert.equal(harness.calls.length, 2)
})

test('provider redirects are reported without following or disguising them as network failures', async (t) => {
  for (const status of [301, 302, 303, 307, 308]) {
    await t.test(String(status), async () => {
      const harness = setup({ fetch: () => new Response('', {
        status,
        headers: { Location: `https://other.example/${testKey}` },
      }) })
      const response = await harness.submit()
      assert.equal(response.status, 502)
      const text = await response.text()
      const result = JSON.parse(text)
      assert.equal(result.diagnostic.code, 'provider_redirect')
      assert.equal(result.diagnostic.upstreamStatus, status)
      assert.match(result.error, /重定向/)
      assert.equal(text.includes(testKey), false)
      assert.equal(JSON.stringify(harness.logs).includes(testKey), false)
      assert.equal(harness.calls.length, 2)
      assert.ok(harness.calls.every(({ init }) => init.redirect === 'manual'))
    })
  }
})

test('timeouts abort both providers', async () => {
  const durations = []
  const harness = setup({
    fetch: () => new Promise(() => {}),
    globals: { setTimeout: (callback, ms) => { durations.push(ms); return setTimeout(callback, 1) } },
  })
  await assert.rejects(harness.indexnow.submitIndexNow(['/']), { code: 'provider_timeout' })
  assert.deepEqual(durations, [4000, 4000])
  assert.equal(harness.calls.every((call) => call.init.signal.aborted), true)
})

test('large submissions batch at 10,000 URLs and preserve partial progress on failure', async () => {
  const paths = Array.from({ length: 10_001 }, (_, i) => `/blog/post-${i}/`)
  const success = setup({ fetch: (_call, count) => new Response('', { status: count === 1 ? 200 : 202 }) })
  const result = await success.indexnow.submitIndexNow(paths)
  assert.equal(result.accepted, 10_000)
  assert.equal(result.pending, 1)
  assert.equal(result.submitted, 10_001)
  assert.deepEqual(success.calls.map((call) => JSON.parse(call.init.body).urlList.length), [10_000, 1])

  const failure = setup({ fetch: (_call, count) => new Response('', { status: count === 1 ? 200 : 403 }) })
  await assert.rejects(failure.indexnow.submitIndexNow(paths), (error) => {
    assert.equal(error.progress.submitted, 10_000)
    assert.equal(error.progress.requested, 10_001)
    assert.equal(error.status, 403)
    return true
  })
})

test('one submission has a shared time budget across all batches', async () => {
  let now = 0
  const harness = setup({
    globals: { Date: class extends Date { static now() { return now } } },
    fetch: () => { now = 12_001; return new Response('') },
  })
  await assert.rejects(harness.indexnow.submitIndexNow(Array.from({ length: 10_001 }, (_, i) => `/p${i}/`)), (error) => {
    assert.equal(error.code, 'submission_timeout')
    assert.equal(error.progress.accepted, 10_000)
    return true
  })
  assert.equal(harness.calls.length, 1)
})

test('unauthorized requests and unavailable post indexes never submit URLs', async () => {
  const unauthorized = setup({ authenticated: false })
  assert.equal((await unauthorized.submit()).status, 401)
  assert.equal(unauthorized.postReads.length, 0)
  assert.equal(unauthorized.calls.length, 0)
  const unavailable = setup({ indexError: new Error(`private ${testKey}`) })
  assert.equal((await unavailable.submit()).status, 503)
  assert.equal(unavailable.calls.length, 0)
  assert.equal(JSON.stringify(unavailable.logs).includes(testKey), false)
})

test('background submission catches failures without rejecting the article save', async () => {
  const harness = setup({ fetch: () => new Response(testKey, { status: 403 }) })
  const tasks = []
  harness.indexnow.queueIndexNow({ waitUntil: (promise) => tasks.push(promise) }, ['/blog/'])
  assert.equal(tasks.length, 1)
  await tasks[0]
  assert.equal(harness.logs.length, 1)
  assert.equal(JSON.stringify(harness.logs).includes(testKey), false)
  assert.equal(harness.calls.length, 1)
})
