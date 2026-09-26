import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'

// Exercise the actual Worker modules without network, a build, or Cloudflare credentials.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexKey = 'blog:index:v1'
const clone = (value) => JSON.parse(JSON.stringify(value))

function article(overrides = {}) {
  return {
    slug: 'hello', title: 'Hello', description: 'An article',
    pubDate: '2026-09-01T00:00:00.000Z', tags: ['技术'], author: 'ANeko',
    featured: false, draft: false, readingTime: 1,
    bodyKey: 'blog/posts/hello/old-version.md', bodyVersion: 'old-version',
    ...overrides,
  }
}

function harness(initial = [article()]) {
  const state = {
    now: Date.parse('2026-09-27T00:00:00.000Z'),
    kv: new Map([[indexKey, JSON.stringify(initial)]]),
    r2: new Map(initial.map((post) => [post.bodyKey, 'original body'])),
    caches: new Map(), faults: new Map(), calls: [], logs: [], submissions: [],
  }
  function operation(name, key) {
    state.calls.push({ name, key })
    for (const fault of [`${name}:${key}`, name]) {
      const remaining = state.faults.get(fault) || 0
      if (remaining > 0) {
        state.faults.set(fault, remaining - 1)
        throw new Error(`Injected ${name} failure`)
      }
    }
  }
  const bindings = {
    ANEKO_KV: {
      async get(key) { operation('kv.get', key); return state.kv.get(key) ?? null },
      async put(key, value) { operation('kv.put', key); state.kv.set(key, value) },
      async delete(key) { operation('kv.delete', key); state.kv.delete(key) },
    },
    ANEKO_R2: {
      async get(key) {
        operation('r2.get', key)
        const body = state.r2.get(key)
        return body === undefined ? null : { async text() { operation('r2.text', key); return body } }
      },
      async put(key, body) { operation('r2.put', key); state.r2.set(key, body) },
      async delete(keys) {
        operation('r2.delete', Array.isArray(keys) ? keys.join(',') : keys)
        for (const key of Array.isArray(keys) ? keys : [keys]) state.r2.delete(key)
      },
      async list({ prefix }) {
        operation('r2.list', prefix)
        return { objects: [...state.r2.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false }
      },
    },
  }
  const cacheStorage = {
    async open(name) {
      operation('cache.open', name)
      if (!state.caches.has(name)) state.caches.set(name, new Map())
      const entries = state.caches.get(name)
      return {
        async match(request) { operation('cache.match', request.url); return entries.get(request.url)?.clone() },
        async put(request, response) { operation('cache.put', request.url); entries.set(request.url, response.clone()) },
        async delete(request) { operation('cache.delete', request.url); return entries.delete(request.url) },
      }
    },
  }
  function worker() {
    class ClockDate extends Date {
      constructor(...args) { super(...(args.length ? args : [state.now])) }
      static now() { return state.now }
    }
    const context = vm.createContext({
      Request, Response, Headers, URL, TextEncoder, TextDecoder,
      Date: ClockDate, crypto: { randomUUID }, caches: cacheStorage,
      setTimeout, clearTimeout,
      console: Object.fromEntries(['error', 'warn', 'log'].map((level) => [level, (...args) => state.logs.push({ level, args })])),
      fetch() { throw new Error('Network is forbidden in these tests') },
    })
    const modules = new Map()
    const mocks = new Map([
      ['src/utils/cloudflare.ts', {
        getBindings: () => bindings, getBlogIndexKey: () => indexKey,
        BLOG_BODY_PREFIX: 'blog/posts/', BLOG_META_PREFIX: 'blog:meta:',
      }],
      ['src/utils/runtime-config.ts', { SITE_ORIGIN: 'https://www.aneko.ink' }],
      ['src/utils/auth.ts', { verifyAdminRequest: async () => true }],
      ['src/utils/indexnow.ts', {
        blogIndexNowPaths: (slug) => [`/blog/${slug}/`],
        queueIndexNow: (_context, paths) => state.submissions.push(paths),
      }],
    ])
    function load(relative) {
      const normalized = relative.replaceAll('\\', '/')
      if (mocks.has(normalized)) return mocks.get(normalized)
      if (modules.has(normalized)) return modules.get(normalized).exports
      const filename = path.join(root, normalized)
      const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      }).outputText
      const module = { exports: {} }
      modules.set(normalized, module)
      const require = (specifier) => {
        assert.ok(specifier.startsWith('.'), `Unexpected runtime dependency: ${specifier}`)
        return load(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)))
      }
      const execute = new vm.Script(`(function (require, module, exports) {\n${source}\n})`, { filename }).runInContext(context)
      execute(require, module, module.exports)
      return module.exports
    }
    return {
      posts: load('src/utils/posts.ts'),
      storage: load('src/utils/blog-storage.ts'),
      api: load('src/pages/api/admin/blog/[slug].ts'),
      admin: load('src/pages/api/admin/blog/index.ts'),
    }
  }
  const current = worker()
  return {
    ...current, state, worker, bindings,
    fail(name, times = Infinity) { state.faults.set(name, times) },
    recover() { state.faults.clear() },
    advance(milliseconds) { state.now += milliseconds },
    count(name) { return state.calls.filter((entry) => entry.name === name).length },
  }
}

function requestContext(method, body, slug = 'hello') {
  return {
    params: { slug }, locals: { cfContext: {} },
    request: new Request(`https://www.aneko.ink/api/admin/blog/${slug}`, {
      method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
    }),
  }
}

const input = () => ({ title: 'Updated', description: 'Updated description', pubDate: '2026-09-27', body: 'updated body', tags: ['技术'] })

test('transient KV and R2 read failures retry once and recover', async () => {
  const h = harness()
  h.fail('kv.get', 1)
  h.fail('r2.get', 1)
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
  assert.equal(h.count('kv.get'), 2)
  assert.equal(h.count('r2.get'), 2)
})

test('transient R2 body stream failure retries the entire read', async () => {
  const h = harness()
  h.fail('r2.text', 1)
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
  assert.equal(h.count('r2.get'), 2)
})

test('fresh named caches work across Worker isolates and refresh after 30 seconds', async () => {
  const h = harness()
  await h.posts.getBlogPost('hello')
  const coldWorker = h.worker()
  assert.equal((await coldWorker.posts.getBlogPost('hello')).body, 'original body')
  assert.equal(h.count('kv.get'), 1)
  assert.equal(h.count('r2.get'), 1)
  assert.ok(h.state.caches.has('aneko-blog-v2'))
  h.advance(30_001)
  await coldWorker.posts.getBlogPost('hello')
  assert.equal(h.count('kv.get'), 2)
  assert.equal(h.count('r2.get'), 2)
})

test('last successful snapshot covers outages for five minutes without extending its lifetime', async () => {
  const h = harness()
  await h.posts.getBlogPost('hello')
  h.advance(30_001)
  h.fail('kv.get')
  h.fail('r2.get')
  assert.equal((await h.worker().posts.getBlogPost('hello')).body, 'original body')
  h.advance(270_000)
  await assert.rejects(h.posts.getBlogPost('hello'), { name: 'BlogDataUnavailableError' })
  h.recover()
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
})

test('body fallback expires even while the index remains available', async () => {
  const h = harness()
  await h.posts.getBlogPost('hello')
  h.advance(300_001)
  h.fail('r2.get')
  await assert.rejects(h.posts.getBlogPost('hello'), { name: 'BlogDataUnavailableError' })
})

test('cold outages fail cleanly and a later request can recover', async () => {
  const h = harness()
  h.fail('kv.get')
  await assert.rejects(h.posts.getPublishedPosts(), { name: 'BlogDataUnavailableError' })
  h.recover()
  assert.equal((await h.posts.getPublishedPosts()).length, 1)
})

test('independent requests do not share a pending storage read', async () => {
  const h = harness()
  let started = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  h.bindings.ANEKO_KV.get = async () => {
    started += 1
    await gate
    return h.state.kv.get(indexKey)
  }
  const first = h.posts.getStoredPostIndex()
  const second = h.posts.getStoredPostIndex()
  try {
    assert.equal(started, 2)
  } finally {
    release()
    await Promise.all([first, second])
  }
})

test('administrator reads refuse cached data during storage outages', async () => {
  const h = harness()
  await h.posts.getPublishedPosts()
  h.fail('kv.get')
  await assert.rejects(h.posts.getStoredPostMetadata('hello'), { name: 'BlogDataUnavailableError' })
  assert.equal((await h.admin.GET(requestContext('GET'))).status, 503)
  assert.equal((await h.api.GET(requestContext('GET'))).status, 503)
})

test('corrupted indexes cannot be silently replaced while saving or deleting', async () => {
  for (const broken of ['{broken json', '{}', JSON.stringify([article(), { slug: 'invalid' }])]) {
    const h = harness()
    await h.posts.getPublishedPosts()
    h.state.kv.set(indexKey, broken)
    assert.equal((await h.api.PUT(requestContext('PUT', input()))).status, 503)
    assert.equal((await h.api.DELETE(requestContext('DELETE'))).status, 503)
    assert.equal(h.state.kv.get(indexKey), broken)
    assert.equal(h.count('kv.put'), 0)
    assert.equal(h.count('r2.put'), 0)
  }
})

test('drafts are excluded and leftover metadata cannot revive an unpublished post', async () => {
  const draft = article({ slug: 'draft', bodyKey: 'blog/posts/draft/body.md', draft: true })
  const h = harness([article(), draft])
  assert.deepEqual(clone((await h.posts.getPublishedPosts()).map((post) => post.id)), ['hello'])
  assert.equal(await h.posts.getBlogPost('draft'), null)
  h.state.kv.set('blog:meta:hello', JSON.stringify(article()))
  await h.posts.saveStoredPostIndex([])
  assert.equal(await h.posts.getBlogPost('hello'), null)
  assert.equal(await h.posts.getStoredPostMetadata('hello'), null)
  assert.equal((await h.api.GET(requestContext('GET'))).status, 404)
})

test('versioned bodies stay consistent with both old and new index snapshots', async () => {
  const old = article()
  const h = harness([old])
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
  const response = await h.api.PUT(requestContext('PUT', input()))
  assert.equal(response.status, 200)
  const updated = (await response.json()).data
  assert.notEqual(updated.bodyVersion, old.bodyVersion)
  assert.notEqual(updated.bodyKey, old.bodyKey)
  assert.equal((await h.worker().posts.getBlogPost('hello')).body, 'updated body')
  h.state.kv.set(indexKey, JSON.stringify([old]))
  await h.posts.getStoredPostIndex()
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
  h.state.kv.set(indexKey, JSON.stringify([updated]))
  await h.posts.getStoredPostIndex()
  assert.equal((await h.posts.getBlogPost('hello')).body, 'updated body')
})

test('a failed publication write preserves the old index and body', async () => {
  const h = harness()
  const originalIndex = h.state.kv.get(indexKey)
  h.fail(`kv.put:${indexKey}`)
  const response = await h.api.PUT(requestContext('PUT', input()))
  assert.equal(response.status, 503)
  assert.equal(h.state.kv.get(indexKey), originalIndex)
  assert.equal(h.state.r2.get(article().bodyKey), 'original body')
  assert.equal((await h.posts.getBlogPost('hello')).body, 'original body')
  assert.equal(h.state.submissions.length, 0)
})

test('metadata mirror failure still reports a successfully published save', async () => {
  const h = harness()
  h.fail('kv.put:blog:meta:hello')
  const response = await h.api.PUT(requestContext('PUT', input()))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).success, true)
  assert.equal((await h.posts.getBlogPost('hello')).body, 'updated body')
  assert.equal(h.state.submissions.length, 1)
  assert.ok(h.state.logs.some((entry) => entry.level === 'warn'))
})

test('delete cleanup errors return cleanupPending after the article is unpublished', async () => {
  const h = harness()
  h.state.kv.set('blog:meta:hello', JSON.stringify(article()))
  await h.posts.getBlogPost('hello')
  h.fail('r2.delete')
  h.fail('kv.delete')
  const response = await h.api.DELETE(requestContext('DELETE'))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).data, { deleted: 'hello', cleanupPending: true })
  assert.deepEqual(JSON.parse(h.state.kv.get(indexKey)), [])
  assert.ok(h.state.kv.has('blog:meta:hello'))
  assert.equal(await h.posts.getBlogPost('hello'), null)
  assert.equal(await h.worker().posts.getStoredPostMetadata('hello'), null)
  assert.equal(h.state.submissions.length, 1)
})

test('explicit body cache invalidation removes the named cached response', async () => {
  const h = harness()
  await h.posts.getBlogPost('hello')
  h.state.r2.set(article().bodyKey, 'refreshed body')
  await h.posts.invalidateBlogPostBodyCache('hello', 'old-version')
  assert.equal((await h.worker().posts.getBlogPost('hello')).body, 'refreshed body')
  assert.equal(h.count('r2.get'), 2)
})

test('missing published bodies are unavailable, not missing articles', async () => {
  const h = harness()
  h.state.r2.clear()
  await assert.rejects(h.posts.getBlogPost('hello'), { name: 'BlogDataUnavailableError' })
  assert.equal(await h.posts.getBlogPost('does-not-exist'), null)
})

test('null and array request bodies return 400 without touching storage', async () => {
  for (const body of [null, [], [input()]]) {
    const h = harness()
    const response = await h.api.PUT(requestContext('PUT', body))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).success, false)
    assert.equal(h.count('kv.get'), 0)
    assert.equal(h.count('r2.put'), 0)
  }
})
