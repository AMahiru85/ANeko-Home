import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/utils/site-content.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(compiled, { exports, URL }, { filename: 'src/utils/site-content.ts' })

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('site content defaults validate and persist to the versioned KV key', async () => {
  const values = new Map()
  const calls = []
  const bindings = {
    ANEKO_KV: {
      async get(key) { calls.push(['get', key]); return values.get(key) ?? null },
      async put(key, value) { calls.push(['put', key]); values.set(key, value) },
    },
  }

  const initial = await exports.readSiteContent(bindings)
  assert.equal(initial.github.username, 'AMahiru85')
  assert.equal(initial.timeline.length, 9)

  const updated = clone(initial)
  updated.github.username = 'new-owner'
  updated.profile.introduction = 'Updated intro'
  await exports.writeSiteContent(bindings, updated)

  const savedRecord = JSON.parse(values.get(exports.SITE_CONTENT_KV_KEY))
  assert.equal(savedRecord.schemaVersion, 1)
  assert.equal(savedRecord.content.github.username, 'new-owner')
  assert.equal((await exports.readSiteContent(bindings)).profile.introduction, 'Updated intro')
  assert.deepEqual(calls.map(([operation]) => operation), ['get', 'put', 'get'])
})

test('site content validation rejects unsafe URLs, invalid GitHub names, and duplicate row IDs', () => {
  const unsafeUrl = clone(exports.DEFAULT_SITE_CONTENT)
  unsafeUrl.externalLinks[0].url = 'javascript:alert(1)'
  assert.throws(() => exports.normalizeSiteContent(unsafeUrl), /HTTP\(S\)/)

  const networkPath = clone(exports.DEFAULT_SITE_CONTENT)
  networkPath.projects[0].url = '/\\\\attacker.example'
  assert.throws(() => exports.normalizeSiteContent(networkPath), /HTTP\(S\)/)

  const invalidUsername = clone(exports.DEFAULT_SITE_CONTENT)
  invalidUsername.github.username = '-bad-name'
  assert.throws(() => exports.normalizeSiteContent(invalidUsername), /GitHub 用户名格式无效/)

  const duplicateIds = clone(exports.DEFAULT_SITE_CONTENT)
  duplicateIds.timeline[1].id = duplicateIds.timeline[0].id
  assert.throws(() => exports.normalizeSiteContent(duplicateIds), /重复 ID/)
})

test('public site content falls back to defaults when KV is unavailable or corrupted', async () => {
  const unavailable = { ANEKO_KV: { async get() { throw new Error('KV unavailable') } } }
  const corrupted = { ANEKO_KV: { async get() { return '{broken json' } } }
  assert.equal((await exports.readSiteContent(unavailable)).github.username, 'AMahiru85')
  assert.equal((await exports.readSiteContent(corrupted)).profile.displayName, 'ANeko')
})

test('admin content reads fail closed when KV is unavailable or the saved value is corrupt', async () => {
  const unavailable = { ANEKO_KV: { async get() { throw new Error('KV unavailable') } } }
  const corrupted = { ANEKO_KV: { async get() { return '{broken json' } } }
  const missing = { ANEKO_KV: { async get() { return null } } }

  await assert.rejects(exports.readAdminSiteContent(unavailable), /暂时无法读取站点内容/u)
  await assert.rejects(exports.readAdminSiteContent(corrupted), /格式损坏/u)
  assert.equal((await exports.readAdminSiteContent(missing)).github.username, 'AMahiru85')
})
