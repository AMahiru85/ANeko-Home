import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

// Resolve Wrangler's existing dependency, including pnpm's isolated layout.
// No package installation, site build, credentials, or external network is needed.
const require = createRequire(import.meta.url)
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare } = wranglerRequire('miniflare')
const miniflareVersion = wranglerRequire('miniflare/package.json').version
const workerdVersion = wranglerRequire('workerd/package.json').version
const origin = 'https://www.aneko.ink'
const primary = 'https://api.indexnow.org/indexnow'
const fakeKey = 'offline-worker-regression-key-1234'

function readSource(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function runtimeModule(path, dependencies) {
  const { outputText } = ts.transpileModule(readSource(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  // The generated module is part of the in-memory Worker script, not eval().
  // Only its external bindings are replaced; its fetch calls use real workerd.
  return `(() => {
    const exports = {};
    const dependencies = ${dependencies};
    const require = (name) => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    };
    ${outputText}
    return exports;
  })()`
}

const workerScript = `
  const cloudflare = {
    getBindings: () => ({ INDEXNOW_KEY: '${fakeKey}' }),
    getIndexNowKey: (bindings) => bindings.INDEXNOW_KEY,
  };
  const posts = {
    POSTS_PER_PAGE: 6,
    tagToSlug: (tag) => tag.toLowerCase(),
    getStoredPostIndex: async () => [],
  };
  const indexnow = ${runtimeModule('src/utils/indexnow.ts', `{
    './cloudflare': cloudflare,
    './posts': posts,
    './runtime-config': { SITE_ORIGIN: '${origin}' },
  }`)};
  const http = ${runtimeModule('src/utils/http.ts', '{}')};
  const admin = ${runtimeModule('src/pages/api/admin/indexnow.ts', `{
    '../../../utils/auth': { verifyAdminRequest: async () => true },
    '../../../utils/cloudflare': cloudflare,
    '../../../utils/http': http,
    '../../../utils/indexnow': indexnow,
    '../../../utils/posts': posts,
  }`)};

  export default {
    async fetch(request) {
      if (new URL(request.url).pathname === '/manual') return admin.POST({ request });
      try {
        return Response.json({ success: true, data: await indexnow.submitIndexNow(['/', '/blog/']) });
      } catch (error) {
        return Response.json({
          success: false,
          error: { kind: error.kind, code: error.code, status: error.status, message: error.message },
        });
      }
    },
  };
`

test('IndexNow uses the real Workers fetch implementation without external network', async (t) => {
  const parsedConfig = ts.parseConfigFileTextToJson('wrangler.jsonc', readSource('wrangler.jsonc'))
  assert.equal(parsedConfig.error, undefined)
  const config = parsedConfig.config
  t.diagnostic(`Miniflare ${miniflareVersion}; workerd ${workerdVersion}; compatibility date ${config.compatibility_date}`)
  let providerStatus = 200
  const calls = []
  const runtime = new Miniflare({
    modules: true,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    script: workerScript,
    // Every outbound fetch is intercepted, including unexpected redirects or
    // calls to this site's own routes. There is deliberately no network fallback.
    outboundService: async (request) => {
      calls.push({ url: request.url, method: request.method, body: await request.text() })
      if (request.url !== primary || request.method !== 'POST') {
        return new Response('Unexpected outbound request blocked by offline test', { status: 599 })
      }
      return new Response('offline-provider-response', {
        status: providerStatus,
        headers: providerStatus === 308 ? { Location: 'https://redirected-provider.invalid/' } : {},
      })
    },
  })

  try {
    for (const status of [200, 202]) {
      await t.test(`HTTP ${status} reaches the provider and preserves acceptance state`, async () => {
        calls.length = 0
        providerStatus = status
        const response = await runtime.dispatchFetch('http://offline-worker.test/submit')
        const result = await response.json()
        assert.equal(result.success, true, JSON.stringify(result))
        assert.equal(result.data.status, status === 200 ? 'accepted' : 'pending')
        assert.equal(result.data.accepted, status === 200 ? 2 : 0)
        assert.equal(result.data.pending, status === 202 ? 2 : 0)
        assert.equal(result.data.submitted, 2)
        assert.equal(calls.length, 1)
        assert.equal(calls[0].url, primary)
        assert.equal(calls[0].method, 'POST')
        assert.deepEqual(JSON.parse(calls[0].body), {
          host: 'www.aneko.ink',
          key: fakeKey,
          keyLocation: `${origin}/${fakeKey}.txt`,
          urlList: [`${origin}/`, `${origin}/blog/`],
        })
      })
    }

    await t.test('HTTP 308 is reported explicitly without following or retrying the redirect', async () => {
      calls.length = 0
      providerStatus = 308
      const response = await runtime.dispatchFetch('http://offline-worker.test/submit')
      const result = await response.json()
      assert.equal(result.success, false)
      assert.equal(result.error.kind, 'upstream')
      assert.equal(result.error.code, 'provider_redirect')
      assert.equal(result.error.status, 308)
      assert.match(result.error.message, /308/)
      assert.equal(result.error.message.includes(fakeKey), false)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, primary)
    })

    await t.test('manual submission makes no self-request to the public key route', async () => {
      calls.length = 0
      providerStatus = 200
      const response = await runtime.dispatchFetch('http://offline-worker.test/manual', { method: 'POST' })
      const result = await response.json()
      assert.equal(response.status, 200, JSON.stringify(result))
      assert.equal(result.success, true)
      assert.equal(result.data.submitted, 7)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, primary)
      assert.equal(calls[0].method, 'POST')
      assert.equal(calls.some((call) => call.url.startsWith(origin)), false)
    })
  } finally {
    // This shuts down workerd and removes Miniflare's temporary runtime storage.
    // The test itself writes no generated Worker files or build artifacts.
    await runtime.dispose()
  }
})
