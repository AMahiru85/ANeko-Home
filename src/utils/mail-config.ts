import { DEFAULT_MAIL_CONFIG_KV_KEY } from './runtime-config'
import {
  CONTROL_CHARACTER_PATTERN,
  EMAIL_PATTERN,
  MAIL_SUBJECT_MAX_LENGTH,
  MAIL_TEXT_MAX_LENGTH,
} from './mail-constants'

const MAIL_CONFIG_SCHEMA_VERSION = 3 as const
const MAIL_WEBHOOK_KEY = 'mail:webhook:v3'
const MAIL_WEBHOOK_SCHEMA_VERSION = 3 as const
const MAX_PASSWORD_LENGTH = 4096
const MIN_WEBHOOK_TOKEN_LENGTH = 32
const MAX_WEBHOOK_TOKEN_LENGTH = 256
const MAX_WEBHOOK_RECIPIENTS = 20
const WEBHOOK_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UNSAFE_HOST_SUFFIXES = ['.internal', '.lan', '.local', '.localhost', '.home', '.invalid', '.test']
const WEBHOOK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const MAX_WEBHOOK_ITEMS = 50
const MAX_WEBHOOK_NAME_LENGTH = 100

export const MAIL_REQUEST_MAX_BODY_BYTES = 2 * 1024 * 1024

export type MailBindings = Pick<
  Env,
  'ANEKO_KV' | 'MAIL_CONFIG_KV_KEY' | 'MAIL_ALLOWED_HOSTS'
>

export interface MailConnectionConfig {
  host: string
  port: 993 | 465
  username: string
  password: string
}

export interface MailWebhookConfiguration {
  revision: string | null
  updatedAt: string | null
  enabled: boolean
  token: string
  to: string[]
  cc: string[]
  subject: string
  text: string
}

export interface MailWebhookTemplate {
  id: string
  name: string
  subject: string
  text: string
}

export interface MailWebhookEndpoint {
  id: string
  name: string
  enabled: boolean
  token: string
  to: string[]
  cc: string[]
  templateId: string
}

export interface MailWebhookStore {
  revision: string | null
  updatedAt: string | null
  templates: MailWebhookTemplate[]
  endpoints: MailWebhookEndpoint[]
}

export interface MailConfiguration {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: MailConnectionConfig
  smtp: MailConnectionConfig
}

export interface MailAdminConfiguration {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: Omit<MailConnectionConfig, 'password'> & { passwordConfigured: boolean }
  smtp: Omit<MailConnectionConfig, 'password'> & { passwordConfigured: boolean }
}

interface MailConfigRecord {
  schemaVersion: typeof MAIL_CONFIG_SCHEMA_VERSION
  revision: string
  updatedAt: string
  configuration: Pick<MailConfiguration, 'address' | 'displayName' | 'imap' | 'smtp'>
}

interface MailWebhookRecord {
  schemaVersion: typeof MAIL_WEBHOOK_SCHEMA_VERSION
  revision: string
  updatedAt: string
  store: Pick<MailWebhookStore, 'templates' | 'endpoints'>
}

type JsonRecord = Record<string, unknown>

export class MailConfigValidationError extends Error {
  constructor(message = 'Invalid mail configuration') {
    super(message)
    this.name = 'MailConfigValidationError'
  }
}

export class MailConfigConflictError extends Error {
  constructor(message = 'Mail configuration has changed; reload and try again') {
    super(message)
    this.name = 'MailConfigConflictError'
  }
}

export class MailConfigUnavailableError extends Error {
  constructor() {
    super('Mail configuration is unavailable')
    this.name = 'MailConfigUnavailableError'
  }
}

function emptyConfiguration(): MailConfiguration {
  return {
    configured: false,
    revision: null,
    updatedAt: null,
    address: '',
    displayName: '',
    imap: { host: '', port: 993, username: '', password: '' },
    smtp: { host: '', port: 465, username: '', password: '' },
  }
}

function emptyWebhookConfiguration(): MailWebhookConfiguration {
  return {
    revision: null,
    updatedAt: null,
    enabled: false,
    token: '',
    to: [],
    cc: [],
    subject: 'Webhook notification',
    text: '{{json}}',
  }
}

function emptyWebhookStore(): MailWebhookStore {
  return { revision: null, updatedAt: null, templates: [], endpoints: [] }
}

function validationError(message: string): never {
  throw new MailConfigValidationError(message)
}

function asRecord(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    validationError(`${field} must be an object`)
  }
  return value as JsonRecord
}

function assertKnownKeys(input: JsonRecord, allowed: readonly string[], field: string) {
  const allowedKeys = new Set(allowed)
  const unexpected = Object.keys(input).find((key) => !allowedKeys.has(key))
  if (unexpected) validationError(`${field}.${unexpected} is not supported`)
}

function textField(
  input: JsonRecord,
  key: string,
  field: string,
  options: { maxLength: number; allowEmpty?: boolean } = { maxLength: 254 },
) {
  const value = input[key]
  if (typeof value !== 'string') validationError(`${field}.${key} must be a string`)
  const normalized = value.trim()
  if (!options.allowEmpty && !normalized) validationError(`${field}.${key} is required`)
  if (normalized.length > options.maxLength || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    validationError(`${field}.${key} is invalid`)
  }
  return normalized
}

function normalizeEmail(value: string, field: string) {
  const normalized = value.toLowerCase()
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    validationError(`${field} must be a valid email address`)
  }
  return normalized
}

function normalizeHostname(value: string, field: string) {
  const hostname = value.toLowerCase().replace(/\.$/, '')
  if (!HOSTNAME_PATTERN.test(hostname)
    || /^\d+(?:\.\d+){3}$/.test(hostname)
    || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    validationError(`${field} must be a public DNS hostname`)
  }
  return hostname
}

function passwordField(input: JsonRecord, existing: string, field: string, endpointChanged: boolean) {
  if (!Object.prototype.hasOwnProperty.call(input, 'password')) {
    if (existing && endpointChanged) {
      validationError(`${field}.password is required when host or username changes`)
    }
    return existing
  }
  const value = input.password
  if (value === null) return ''
  if (typeof value !== 'string' || !value || value.length > MAX_PASSWORD_LENGTH) {
    validationError(`${field}.password must be omitted, null, or a non-empty string`)
  }
  return value
}

function normalizeConnection(
  value: unknown,
  field: 'imap' | 'smtp',
  existing: MailConnectionConfig,
): MailConnectionConfig {
  const input = asRecord(value, field)
  assertKnownKeys(input, ['host', 'port', 'username', 'password', 'passwordConfigured'], field)
  const expectedPort = field === 'imap' ? 993 : 465
  if (input.port !== expectedPort) validationError(`${field}.port must be ${expectedPort}`)

  const host = normalizeHostname(textField(input, 'host', field, { maxLength: 253 }), `${field}.host`)
  const username = textField(input, 'username', field, { maxLength: 320 })
  const endpointChanged = host !== existing.host || username !== existing.username

  return {
    host,
    port: expectedPort,
    username,
    password: passwordField(input, existing.password, field, endpointChanged),
  }
}

function normalizeWebhookRecipients(value: unknown, field: string) {
  if (!Array.isArray(value)) validationError(`${field} must be an array`)
  const recipients: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') validationError(`${field} must contain email addresses`)
    const email = normalizeEmail(item.trim(), field)
    if (!recipients.includes(email)) recipients.push(email)
  }
  return recipients
}

function webhookTokenField(input: JsonRecord, existing: string) {
  if (!Object.prototype.hasOwnProperty.call(input, 'token')) return existing
  if (input.token === null) return ''
  if (typeof input.token !== 'string') validationError('webhook.token must be a string or null')
  const token = input.token.trim()
  if (token.length < MIN_WEBHOOK_TOKEN_LENGTH
    || token.length > MAX_WEBHOOK_TOKEN_LENGTH
    || !WEBHOOK_TOKEN_PATTERN.test(token)) {
    validationError(`webhook.token must be between ${MIN_WEBHOOK_TOKEN_LENGTH} and ${MAX_WEBHOOK_TOKEN_LENGTH} characters`)
  }
  return token
}

function webhookTemplateField(
  input: JsonRecord,
  key: 'subject' | 'text',
  maxLength: number,
) {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    validationError(`webhook.${key} is invalid`)
  }
  if (key === 'subject' && CONTROL_CHARACTER_PATTERN.test(value)) {
    validationError('webhook.subject must be a single line')
  }
  return key === 'subject' ? value.trim() : value
}

function webhookId(value: unknown, field: string) {
  if (typeof value !== 'string' || !WEBHOOK_ID_PATTERN.test(value)) {
    validationError(`${field} must be 1-64 letters, digits, dots, underscores, or hyphens`)
  }
  return value
}

function webhookName(value: unknown, field: string) {
  if (typeof value !== 'string') validationError(`${field} must be a string`)
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_WEBHOOK_NAME_LENGTH || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    validationError(`${field} is invalid`)
  }
  return normalized
}

function normalizeWebhookTemplate(value: unknown): MailWebhookTemplate {
  const input = asRecord(value, 'template')
  assertKnownKeys(input, ['id', 'name', 'subject', 'text'], 'template')
  const id = webhookId(input.id, 'template.id')
  return {
    id,
    name: webhookName(input.name, 'template.name'),
    subject: webhookTemplateField(input, 'subject', MAIL_SUBJECT_MAX_LENGTH),
    text: webhookTemplateField(input, 'text', MAIL_TEXT_MAX_LENGTH),
  }
}

function normalizeWebhookEndpoint(
  value: unknown,
  existing: MailWebhookEndpoint | undefined,
  templateIds: Set<string>,
): MailWebhookEndpoint {
  const input = asRecord(value, 'endpoint')
  assertKnownKeys(input, ['id', 'name', 'enabled', 'token', 'to', 'cc', 'templateId'], 'endpoint')
  const id = webhookId(input.id, 'endpoint.id')
  if (typeof input.enabled !== 'boolean') validationError('endpoint.enabled must be a boolean')
  const token = webhookTokenField(input, existing?.token || '')
  const to = normalizeWebhookRecipients(input.to, 'endpoint.to')
  const cc = normalizeWebhookRecipients(input.cc, 'endpoint.cc')
  if (to.length + cc.length > MAX_WEBHOOK_RECIPIENTS) validationError(`endpoint supports at most ${MAX_WEBHOOK_RECIPIENTS} recipients`)
  if (typeof input.templateId !== 'string' || !templateIds.has(input.templateId)) {
    validationError('endpoint.templateId must reference an existing template')
  }
  if (input.enabled && (!token || !to.length)) validationError('enabled endpoint requires a token and at least one recipient')
  return { id, name: webhookName(input.name, 'endpoint.name'), enabled: input.enabled, token, to, cc, templateId: input.templateId }
}

function normalizeWebhookStore(value: unknown, existing: MailWebhookStore): MailWebhookStore {
  const input = asRecord(value, 'body')
  assertKnownKeys(input, ['revision', 'templates', 'endpoints'], 'body')
  if (!Array.isArray(input.templates) || input.templates.length > MAX_WEBHOOK_ITEMS) validationError(`body.templates must contain at most ${MAX_WEBHOOK_ITEMS} items`)
  if (!Array.isArray(input.endpoints) || input.endpoints.length > MAX_WEBHOOK_ITEMS) validationError(`body.endpoints must contain at most ${MAX_WEBHOOK_ITEMS} items`)
  const templates = input.templates.map((item) => normalizeWebhookTemplate(item))
  const templateIds = new Set<string>()
  for (const template of templates) {
    if (templateIds.has(template.id)) validationError(`template.${template.id} is duplicated`)
    templateIds.add(template.id)
  }
  const existingEndpoints = new Map(existing.endpoints.map((item) => [item.id, item]))
  const endpoints = input.endpoints.map((item) => {
    const record = asRecord(item, 'endpoint')
    const id = typeof record.id === 'string' ? record.id : ''
    return normalizeWebhookEndpoint(item, existingEndpoints.get(id), templateIds)
  })
  const endpointIds = new Set<string>()
  for (const endpoint of endpoints) {
    if (endpointIds.has(endpoint.id)) validationError(`endpoint.${endpoint.id} is duplicated`)
    endpointIds.add(endpoint.id)
  }
  if (!templateIds.has('default')) validationError('the default template is required')
  if (!endpointIds.has('default')) validationError('the default endpoint is required')
  return { revision: existing.revision, updatedAt: existing.updatedAt, templates, endpoints }
}

function legacyWebhookStoreInput(input: JsonRecord, existing: MailWebhookStore) {
  assertKnownKeys(input, ['revision', 'enabled', 'token', 'to', 'cc', 'subject', 'text'], 'body')
  const currentTemplate = existing.templates.find((template) => template.id === 'default')
  const currentEndpoint = existing.endpoints.find((endpoint) => endpoint.id === 'default')
  const template: JsonRecord = {
    id: 'default',
    name: currentTemplate?.name || '默认模板',
    subject: input.subject,
    text: input.text,
  }
  const endpoint: JsonRecord = {
    id: 'default',
    name: currentEndpoint?.name || '默认接口',
    enabled: input.enabled,
    to: input.to,
    cc: input.cc,
    templateId: 'default',
  }
  if (Object.prototype.hasOwnProperty.call(input, 'token')) endpoint.token = input.token
  return {
    revision: input.revision,
    templates: [template, ...existing.templates.filter((item) => item.id !== 'default')],
    endpoints: [endpoint, ...existing.endpoints.filter((item) => item.id !== 'default')],
  }
}

function normalizeConfiguration(value: unknown, existing: MailConfiguration): MailConfiguration {
  const input = asRecord(value, 'body')
  assertKnownKeys(input, ['revision', 'address', 'displayName', 'imap', 'smtp'], 'body')

  const address = normalizeEmail(textField(input, 'address', 'body', { maxLength: 254 }), 'body.address')
  const displayName = textField(input, 'displayName', 'body', {
    maxLength: 80,
    allowEmpty: true,
  })

  const imap = normalizeConnection(input.imap, 'imap', existing.imap)
  const smtp = normalizeConnection(input.smtp, 'smtp', existing.smtp)

  return {
    configured: Boolean(imap.password && smtp.password),
    revision: existing.revision,
    updatedAt: existing.updatedAt,
    address,
    displayName,
    imap,
    smtp,
  }
}

function parseExpectedRevision(value: unknown) {
  const input = asRecord(value, 'body')
  if (!Object.prototype.hasOwnProperty.call(input, 'revision')) {
    validationError('body.revision is required')
  }
  if (input.revision !== null
    && (typeof input.revision !== 'string' || !UUID_PATTERN.test(input.revision))) {
    validationError('body.revision must be a valid revision or null')
  }
  return input.revision as string | null
}

function parseAllowedHosts(value?: string) {
  const entries = new Set<string>()
  for (const rawEntry of (value || '').split(/[\s,;]+/u)) {
    const entry = rawEntry.trim().toLowerCase()
    if (!entry) continue
    entries.add(normalizeHostname(entry, 'MAIL_ALLOWED_HOSTS'))
  }
  return entries
}

function validateMailHostsAllowed(bindings: MailBindings, configuration: MailConfiguration) {
  const allowed = parseAllowedHosts(bindings.MAIL_ALLOWED_HOSTS)
  if (!allowed.size) return
  for (const connection of [configuration.imap, configuration.smtp]) {
    if (!allowed.has(connection.host)) {
      validationError('A mail server is not in MAIL_ALLOWED_HOSTS')
    }
  }
}

export function assertMailHostsAllowed(bindings: MailBindings, configuration: MailConfiguration) {
  if (!configuration.configured) throw new MailConfigUnavailableError()
  validateMailHostsAllowed(bindings, configuration)
}

function getKvKey(bindings: MailBindings) {
  return bindings.MAIL_CONFIG_KV_KEY?.trim() || DEFAULT_MAIL_CONFIG_KV_KEY
}

function validateStoredRecord(
  input: JsonRecord,
  allowedKeys: readonly string[],
  schemaVersion: number,
  field: string,
) {
  assertKnownKeys(input, allowedKeys, field)
  if (input.schemaVersion !== schemaVersion
    || typeof input.revision !== 'string'
    || !UUID_PATTERN.test(input.revision)
    || typeof input.updatedAt !== 'string'
    || Number.isNaN(Date.parse(input.updatedAt))) {
    throw new MailConfigUnavailableError()
  }
}

function parseMailConfigRecord(value: unknown): MailConfigRecord {
  const field = 'stored configuration'
  const input = asRecord(value, field)
  validateStoredRecord(
    input,
    ['schemaVersion', 'revision', 'updatedAt', 'configuration'],
    MAIL_CONFIG_SCHEMA_VERSION,
    field,
  )
  asRecord(input.configuration, `${field}.configuration`)
  return input as unknown as MailConfigRecord
}

function readStoredConfiguration(record: MailConfigRecord) {
  const configuration = normalizeConfiguration(
    { ...record.configuration, revision: record.revision },
    emptyConfiguration(),
  )
  return {
    ...configuration,
    revision: record.revision,
    updatedAt: record.updatedAt,
  }
}

function createMailConfigRecord(
  configuration: MailConfiguration,
  revision: string,
  updatedAt: string,
): MailConfigRecord {
  return {
    schemaVersion: MAIL_CONFIG_SCHEMA_VERSION,
    revision,
    updatedAt,
    configuration: {
      address: configuration.address,
      displayName: configuration.displayName,
      imap: configuration.imap,
      smtp: configuration.smtp,
    },
  }
}

function createMailWebhookRecord(
  store: MailWebhookStore,
  revision: string,
  updatedAt: string,
): MailWebhookRecord {
  return {
    schemaVersion: MAIL_WEBHOOK_SCHEMA_VERSION,
    revision,
    updatedAt,
    store: { templates: store.templates, endpoints: store.endpoints },
  }
}

function parseMailWebhookRecord(value: unknown): MailWebhookRecord {
  const field = 'stored webhook configuration'
  const input = asRecord(value, field)
  validateStoredRecord(
    input,
    ['schemaVersion', 'revision', 'updatedAt', 'store'],
    MAIL_WEBHOOK_SCHEMA_VERSION,
    field,
  )
  asRecord(input.store, `${field}.store`)
  return input as unknown as MailWebhookRecord
}

function readStoredWebhookStore(record: MailWebhookRecord): MailWebhookStore {
  const store = normalizeWebhookStore(
    { ...record.store, revision: record.revision },
    emptyWebhookStore(),
  )
  return { ...store, revision: record.revision, updatedAt: record.updatedAt }
}

export async function readMailConfiguration(bindings: MailBindings): Promise<MailConfiguration> {
  const raw = await bindings.ANEKO_KV.get(getKvKey(bindings))
  if (!raw) return emptyConfiguration()
  try {
    return readStoredConfiguration(parseMailConfigRecord(JSON.parse(raw)))
  } catch (error) {
    if (error instanceof MailConfigUnavailableError) throw error
    throw new MailConfigUnavailableError()
  }
}

export async function saveMailConfiguration(bindings: MailBindings, value: unknown) {
  const existing = await readMailConfiguration(bindings)
  const expectedRevision = parseExpectedRevision(value)
  if (expectedRevision !== existing.revision) throw new MailConfigConflictError()
  const configuration = normalizeConfiguration(value, existing)
  validateMailHostsAllowed(bindings, configuration)

  const revision = crypto.randomUUID()
  const updatedAt = new Date().toISOString()
  const record = createMailConfigRecord(configuration, revision, updatedAt)
  await bindings.ANEKO_KV.put(getKvKey(bindings), JSON.stringify(record))
  return { ...configuration, revision, updatedAt }
}

function defaultWebhookStore(): MailWebhookStore {
  const configuration = emptyWebhookConfiguration()
  const template: MailWebhookTemplate = {
    id: 'default',
    name: '默认模板',
    subject: configuration.subject,
    text: configuration.text,
  }
  const endpoint: MailWebhookEndpoint = {
    id: 'default',
    name: '默认接口',
    enabled: configuration.enabled,
    token: configuration.token,
    to: [...configuration.to],
    cc: [...configuration.cc],
    templateId: template.id,
  }
  return {
    revision: configuration.revision,
    updatedAt: configuration.updatedAt,
    templates: [template],
    endpoints: [endpoint],
  }
}

export async function readMailWebhookStore(bindings: MailBindings): Promise<MailWebhookStore> {
  const raw = await bindings.ANEKO_KV.get(MAIL_WEBHOOK_KEY)
  if (raw) {
    try {
      return readStoredWebhookStore(parseMailWebhookRecord(JSON.parse(raw)))
    } catch (error) {
      if (error instanceof MailConfigUnavailableError) throw error
      throw new MailConfigUnavailableError()
    }
  }
  return defaultWebhookStore()
}

export async function saveMailWebhookStore(bindings: MailBindings, value: unknown) {
  const existing = await readMailWebhookStore(bindings)
  const expectedRevision = parseExpectedRevision(value)
  if (expectedRevision !== existing.revision) {
    throw new MailConfigConflictError('Webhook configuration has changed; reload and try again')
  }
  const input = asRecord(value, 'body')
  const storeInput = Object.prototype.hasOwnProperty.call(input, 'templates')
    || Object.prototype.hasOwnProperty.call(input, 'endpoints')
    ? input
    : legacyWebhookStoreInput(input, existing)
  const store = normalizeWebhookStore(storeInput, existing)
  const revision = crypto.randomUUID()
  const updatedAt = new Date().toISOString()
  const record = createMailWebhookRecord(store, revision, updatedAt)
  await bindings.ANEKO_KV.put(MAIL_WEBHOOK_KEY, JSON.stringify(record))
  return { ...store, revision, updatedAt }
}

export function adminMailWebhookStore(store: MailWebhookStore) {
  const defaultEndpoint = store.endpoints.find((endpoint) => endpoint.id === 'default')
  const defaultTemplate = defaultEndpoint
    ? store.templates.find((template) => template.id === defaultEndpoint.templateId)
    : undefined
  return {
    revision: store.revision,
    updatedAt: store.updatedAt,
    templates: store.templates.map((template) => ({ ...template })),
    endpoints: store.endpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      enabled: endpoint.enabled,
      tokenConfigured: Boolean(endpoint.token),
      to: [...endpoint.to],
      cc: [...endpoint.cc],
      templateId: endpoint.templateId,
    })),
    // Keep the legacy projection for cached clients from the single-webhook release.
    enabled: Boolean(defaultEndpoint?.enabled),
    tokenConfigured: Boolean(defaultEndpoint?.token),
    to: defaultEndpoint ? [...defaultEndpoint.to] : [],
    cc: defaultEndpoint ? [...defaultEndpoint.cc] : [],
    subject: defaultTemplate?.subject || '',
    text: defaultTemplate?.text || '',
  }
}

export function publicMailWebhook(store: MailWebhookStore, id: string) {
  const endpoint = store.endpoints.find((item) => item.id === id)
  if (!endpoint) return null
  const template = store.templates.find((item) => item.id === endpoint.templateId)
  if (!template) return null
  return {
    ...endpoint,
    subject: template.subject,
    text: template.text,
  }
}

export async function resolveMailDraft(
  bindings: MailBindings,
  value?: unknown,
  allowIncompletePassword = false,
) {
  const existing = await readMailConfiguration(bindings)
  let configuration: MailConfiguration
  if (value === undefined) {
    configuration = existing
  } else if (allowIncompletePassword) {
    const input = asRecord(value, 'body')
    assertKnownKeys(input, ['address', 'displayName', 'imap', 'smtp'], 'body')
    configuration = normalizeConfiguration({ ...input, revision: existing.revision }, existing)
  } else {
    configuration = normalizeConfiguration(value, existing)
  }
  if (!configuration.configured && !allowIncompletePassword) throw new MailConfigUnavailableError()
  validateMailHostsAllowed(bindings, configuration)
  return configuration
}

export function adminMailConfiguration(configuration: MailConfiguration): MailAdminConfiguration {
  const projectConnection = (connection: MailConnectionConfig) => ({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    passwordConfigured: Boolean(connection.password),
  })
  return {
    configured: configuration.configured,
    revision: configuration.revision,
    updatedAt: configuration.updatedAt,
    address: configuration.address,
    displayName: configuration.displayName,
    imap: projectConnection(configuration.imap),
    smtp: projectConnection(configuration.smtp),
  }
}
