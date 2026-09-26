import { CFImap, type Email as ImapEmail, type Folder } from 'cf-imap'
import { LogLevel, WorkerMailer } from 'worker-mailer'
import type { MailBindings, MailConfiguration } from './mail-config'
import {
  CONTROL_CHARACTER_PATTERN,
  EMAIL_PATTERN,
  MAIL_SUBJECT_MAX_LENGTH,
  MAIL_TEXT_MAX_LENGTH,
} from './mail-constants'

const MAX_MESSAGE_BYTES = 8 * 1024 * 1024
const MAX_FOLDER_LENGTH = 512
const MAX_LIST_LIMIT = 25
const MAX_RECIPIENTS = 20
const MAX_IDEMPOTENCY_KEY_LENGTH = 128
const SEND_RATE_LIMIT = 10
const SEND_RATE_WINDOW_SECONDS = 60
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
const IDEMPOTENCY_PENDING_TTL_SECONDS = 24 * 60 * 60
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

type JsonRecord = Record<string, unknown>

export class MailServiceInputError extends Error {
  constructor(message = 'Invalid mail request') {
    super(message)
    this.name = 'MailServiceInputError'
  }
}

export class MailServiceConflictError extends Error {
  constructor(message = 'Mail request conflicts with current state') {
    super(message)
    this.name = 'MailServiceConflictError'
  }
}

export class MailServiceNotFoundError extends Error {
  constructor() {
    super('Message was not found')
    this.name = 'MailServiceNotFoundError'
  }
}

export class MailServiceTooLargeError extends Error {
  constructor() {
    super('Message is too large to open')
    this.name = 'MailServiceTooLargeError'
  }
}

export class MailServiceRateLimitError extends Error {
  retryAfter: number

  constructor(retryAfter: number) {
    super('Too many mail send requests')
    this.name = 'MailServiceRateLimitError'
    this.retryAfter = retryAfter
  }
}

export class MailServiceUnavailableError extends Error {
  constructor() {
    super('Mail service is unavailable')
    this.name = 'MailServiceUnavailableError'
  }
}

function asRecord(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MailServiceInputError(`${field} must be an object`)
  }
  return value as JsonRecord
}

function normalizeFolder(value: string | null) {
  const folder = value?.trim() || ''
  if (!folder || folder.length > MAX_FOLDER_LENGTH || CONTROL_CHARACTER_PATTERN.test(folder)) {
    throw new MailServiceInputError('folder is invalid')
  }
  return folder
}

function positiveInteger(value: string | null, field: string) {
  if (!value || !/^\d+$/.test(value)) throw new MailServiceInputError(`${field} is invalid`)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new MailServiceInputError(`${field} is invalid`)
  }
  return number
}

function createImap(configuration: MailConfiguration) {
  if (!configuration.imap.password) throw new MailServiceUnavailableError()
  return new CFImap({
    host: configuration.imap.host,
    port: 993,
    tls: true,
    auth: {
      username: configuration.imap.username,
      password: configuration.imap.password,
    },
    timeoutMs: 20_000,
  })
}

async function withImap<T>(configuration: MailConfiguration, operation: (imap: CFImap) => Promise<T>) {
  const imap = createImap(configuration)
  try {
    await imap.connect()
    return await operation(imap)
  } catch (error) {
    if (error instanceof MailServiceInputError
      || error instanceof MailServiceConflictError
      || error instanceof MailServiceNotFoundError
      || error instanceof MailServiceTooLargeError) {
      throw error
    }
    throw new MailServiceUnavailableError()
  } finally {
    try {
      await imap.logout()
    } catch {
      // The connection may already be closed after a server or timeout error.
    }
  }
}

function createMailer(configuration: MailConfiguration) {
  if (!configuration.smtp.password) throw new MailServiceUnavailableError()
  return WorkerMailer.connect({
    host: configuration.smtp.host,
    port: 465,
    secure: true,
    startTls: false,
    credentials: {
      username: configuration.smtp.username,
      password: configuration.smtp.password,
    },
    authType: ['plain', 'login'],
    logLevel: LogLevel.NONE,
    socketTimeoutMs: 20_000,
    responseTimeoutMs: 20_000,
  })
}

async function testSmtpConnection(configuration: MailConfiguration) {
  let mailer: WorkerMailer | undefined
  try {
    mailer = await createMailer(configuration)
  } catch {
    throw new MailServiceUnavailableError()
  } finally {
    if (mailer) {
      try {
        await mailer.close()
      } catch {
        // A successful authenticated connection is enough for this test.
      }
    }
  }
}

export async function testMailConnection(configuration: MailConfiguration, target: 'imap' | 'smtp') {
  if (target === 'imap') {
    await withImap(configuration, async () => undefined)
  } else {
    await testSmtpConnection(configuration)
  }
  return { target, ok: true as const }
}

function canSelectFolder(folder: Folder) {
  return !folder.attributes.some(
    (attribute) => attribute.replace(/^\\/, '').toLowerCase() === 'noselect',
  )
}

export async function listMailFolders(configuration: MailConfiguration) {
  return withImap(configuration, async (imap) => {
    const folders = await imap.getFolders('', '*')
    const output: Array<{
      name: string
      delimiter: string
      attributes: string[]
      total: number
      unread: number
    }> = []

    for (const folder of folders.slice(0, 100)) {
      let total = 0
      let unread = 0
      if (canSelectFolder(folder)) {
        const status = await imap.status(folder.name, ['MESSAGES', 'UNSEEN'])
        total = status.messages || 0
        unread = status.unseen || 0
      }
      output.push({
        name: folder.name,
        delimiter: folder.delimiter,
        attributes: folder.attributes,
        total,
        unread,
      })
    }
    return { folders: output }
  })
}

function dateValue(email: ImapEmail) {
  const headerDate = email.headers.date
  if (headerDate && !Number.isNaN(Date.parse(headerDate))) return new Date(headerDate).toISOString()
  return email.internalDate instanceof Date && !Number.isNaN(email.internalDate.getTime())
    ? email.internalDate.toISOString()
    : null
}

function messageSummary(email: ImapEmail) {
  return {
    uid: email.uid,
    subject: email.subject || '',
    from: email.from,
    to: email.to,
    cc: email.cc,
    date: dateValue(email),
    size: email.size,
    seen: email.flags.some((flag) => flag.toLowerCase() === 'seen'),
    flags: email.flags,
    messageId: email.messageID || '',
  }
}

export interface MailListOptions {
  folder: string
  cursor: number | null
  uidValidity: number | null
  limit: number
}

export function parseMailListOptions(url: URL): MailListOptions {
  const folder = normalizeFolder(url.searchParams.get('folder'))
  const rawLimit = url.searchParams.get('limit')
  const limit = rawLimit === null ? 20 : positiveInteger(rawLimit, 'limit')
  if (limit > MAX_LIST_LIMIT) throw new MailServiceInputError(`limit must be at most ${MAX_LIST_LIMIT}`)
  const rawCursor = url.searchParams.get('cursor')
  const rawUidValidity = url.searchParams.get('uidValidity')
  const cursor = rawCursor === null || rawCursor === '' ? null : positiveInteger(rawCursor, 'cursor')
  return {
    folder,
    cursor,
    uidValidity: cursor === null
      ? null
      : positiveInteger(rawUidValidity, 'uidValidity'),
    limit,
  }
}

export async function listMailMessages(configuration: MailConfiguration, options: MailListOptions) {
  return withImap(configuration, async (imap) => {
    const mailbox = await imap.examine(options.folder)
    if (!mailbox.uidValidity) throw new MailServiceUnavailableError()
    if (options.uidValidity !== null && options.uidValidity !== mailbox.uidValidity) {
      throw new MailServiceConflictError('Mailbox changed; refresh the message list')
    }
    const allUids = await imap.searchEmails({ all: true, useUid: true })
    const candidates = [...new Set(allUids)]
      .filter((uid) => Number.isSafeInteger(uid) && uid > 0 && (options.cursor === null || uid < options.cursor))
      .sort((left, right) => right - left)
    const selected = candidates.slice(0, options.limit)
    const messages: ImapEmail[] = []

    for (const uid of selected) {
      const fetched = await imap.fetchEmails({ limit: uid, fetchBody: false, peek: true, useUid: true })
      const exact = fetched.find((message) => message.uid === uid)
      if (exact) messages.push(exact)
    }

    return {
      folder: options.folder,
      uidValidity: mailbox.uidValidity,
      messages: messages.map(messageSummary),
      nextCursor: candidates.length > selected.length && selected.length
        ? String(selected[selected.length - 1])
        : null,
    }
  })
}

export interface MailMessageTarget {
  folder: string
  uid: number
  uidValidity: number
}

export function parseMailMessageTarget(url: URL, rawUid: string | undefined): MailMessageTarget {
  return {
    folder: normalizeFolder(url.searchParams.get('folder')),
    uid: positiveInteger(rawUid || null, 'uid'),
    uidValidity: positiveInteger(url.searchParams.get('uidValidity'), 'uidValidity'),
  }
}

async function assertUidValidity(imap: CFImap, target: MailMessageTarget, readOnly: boolean) {
  const mailbox = readOnly
    ? await imap.examine(target.folder)
    : await imap.selectFolder(target.folder)
  if (!mailbox.uidValidity || mailbox.uidValidity !== target.uidValidity) {
    throw new MailServiceConflictError('Mailbox changed; refresh the message list')
  }
}

export async function getMailMessage(configuration: MailConfiguration, target: MailMessageTarget) {
  return withImap(configuration, async (imap) => {
    await assertUidValidity(imap, target, true)
    const headers = await imap.fetchEmails({
      limit: target.uid,
      fetchBody: false,
      peek: true,
      useUid: true,
    })
    const header = headers.find((message) => message.uid === target.uid)
    if (!header) throw new MailServiceNotFoundError()
    if (header.size >= MAX_MESSAGE_BYTES) throw new MailServiceTooLargeError()

    const fetched = await imap.fetchEmails({
      limit: target.uid,
      fetchBody: true,
      byteLimit: MAX_MESSAGE_BYTES - 1,
      peek: true,
      useUid: true,
    })
    const message = fetched.find((item) => item.uid === target.uid)
    if (!message) throw new MailServiceNotFoundError()
    return {
      folder: target.folder,
      uidValidity: target.uidValidity,
      message: {
        ...messageSummary(message),
        text: message.body.text || '',
        html: message.body.html || '',
        attachments: message.attachments.map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          contentId: attachment.contentId || null,
          inline: attachment.isInline,
        })),
      },
    }
  })
}

export async function setMailMessageSeen(
  configuration: MailConfiguration,
  target: MailMessageTarget,
  value: unknown,
) {
  const input = asRecord(value, 'body')
  if (Object.keys(input).some((key) => key !== 'seen') || typeof input.seen !== 'boolean') {
    throw new MailServiceInputError('body.seen must be a boolean')
  }
  return withImap(configuration, async (imap) => {
    await assertUidValidity(imap, target, false)
    await imap.storeFlags(
      String(target.uid),
      ['Seen'],
      input.seen ? 'add' : 'remove',
      true,
    )
    const fetched = await imap.fetchEmails({
      limit: target.uid,
      fetchBody: false,
      peek: true,
      useUid: true,
    })
    const message = fetched.find((item) => item.uid === target.uid)
    if (!message) throw new MailServiceNotFoundError()
    return {
      uid: target.uid,
      seen: message.flags.some((flag) => flag.toLowerCase() === 'seen'),
    }
  })
}

function normalizeRecipients(value: unknown, field: 'to' | 'cc') {
  if (!Array.isArray(value)) throw new MailServiceInputError(`body.${field} must be an array`)
  const recipients: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new MailServiceInputError(`body.${field} is invalid`)
    const email = item.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email) || email.length > 254 || recipients.includes(email)) {
      throw new MailServiceInputError(`body.${field} is invalid`)
    }
    recipients.push(email)
  }
  return recipients
}

export interface SendMailInput {
  idempotencyKey: string
  to: string[]
  cc: string[]
  subject: string
  text: string
}

export function parseSendMailInput(value: unknown): SendMailInput {
  const input = asRecord(value, 'body')
  if (Object.keys(input).some((key) => !['idempotencyKey', 'to', 'cc', 'subject', 'text'].includes(key))) {
    throw new MailServiceInputError('body contains unsupported fields')
  }
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : ''
  if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new MailServiceInputError('body.idempotencyKey is invalid')
  }
  const to = normalizeRecipients(input.to, 'to')
  const cc = normalizeRecipients(input.cc, 'cc')
  if (!to.length || to.length + cc.length > MAX_RECIPIENTS) {
    throw new MailServiceInputError(`between 1 and ${MAX_RECIPIENTS} recipients are required`)
  }
  if (typeof input.subject !== 'string'
    || input.subject.length > MAIL_SUBJECT_MAX_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(input.subject)) {
    throw new MailServiceInputError('body.subject is invalid')
  }
  if (typeof input.text !== 'string' || !input.text || input.text.length > MAIL_TEXT_MAX_LENGTH) {
    throw new MailServiceInputError('body.text is invalid')
  }
  return { idempotencyKey, to, cc, subject: input.subject, text: input.text }
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

interface IdempotencyRecord {
  hash: string
  status: 'pending' | 'sent' | 'unknown'
  createdAt: number
}

async function readIdempotencyRecord(bindings: MailBindings, key: string) {
  try {
    const raw = await bindings.ANEKO_KV.get(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<IdempotencyRecord> | null
    if (!parsed
      || typeof parsed.hash !== 'string'
      || !['pending', 'sent', 'unknown'].includes(parsed.status || '')
      || typeof parsed.createdAt !== 'number'
      || !Number.isSafeInteger(parsed.createdAt)) throw new Error('Invalid idempotency record')
    return parsed as IdempotencyRecord
  } catch {
    throw new MailServiceUnavailableError()
  }
}

async function enforceSendRate(bindings: MailBindings, request: Request) {
  const identity = request.headers.get('CF-Connecting-IP') || 'unknown'
  const window = Math.floor(Date.now() / (SEND_RATE_WINDOW_SECONDS * 1000))
  const key = `mail:send:rate:v1:${await sha256(identity)}:${window}`
  const rawCount = await bindings.ANEKO_KV.get(key)
  if (rawCount !== null && !/^\d+$/.test(rawCount)) throw new MailServiceUnavailableError()
  const count = Number(rawCount || 0)
  if (count >= SEND_RATE_LIMIT) {
    const retryAfter = SEND_RATE_WINDOW_SECONDS - Math.floor(Date.now() / 1000) % SEND_RATE_WINDOW_SECONDS
    throw new MailServiceRateLimitError(retryAfter)
  }
  await bindings.ANEKO_KV.put(key, String(count + 1), {
    expirationTtl: SEND_RATE_WINDOW_SECONDS * 2,
  })
}

export async function sendMail(
  bindings: MailBindings,
  configuration: MailConfiguration,
  request: Request,
  input: SendMailInput,
) {
  if (!configuration.smtp.password) throw new MailServiceUnavailableError()
  const payloadHash = await sha256(JSON.stringify({
    from: configuration.address,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.text,
  }))
  const idempotencyKey = `mail:send:idempotency:v1:${await sha256(input.idempotencyKey)}`
  const existing = await readIdempotencyRecord(bindings, idempotencyKey)
  if (existing) {
    if (existing.hash !== payloadHash) {
      throw new MailServiceConflictError('Idempotency key was already used')
    }
    if (existing.status === 'sent') {
      return { sent: true as const, idempotencyKey: input.idempotencyKey, replayed: true }
    }
    if (existing.status === 'unknown') {
      throw new MailServiceConflictError('Mail delivery status is unknown; check Sent before retrying')
    }
    throw new MailServiceConflictError('Mail request is already in progress')
  }

  await enforceSendRate(bindings, request)
  await bindings.ANEKO_KV.put(
    idempotencyKey,
    JSON.stringify({ hash: payloadHash, status: 'pending', createdAt: Date.now() } satisfies IdempotencyRecord),
    { expirationTtl: IDEMPOTENCY_PENDING_TTL_SECONDS },
  )

  try {
    let mailer: WorkerMailer | undefined
    try {
      mailer = await createMailer(configuration)
      await mailer.send({
        from: configuration.displayName
          ? { name: configuration.displayName, email: configuration.address }
          : configuration.address,
        to: input.to,
        cc: input.cc.length ? input.cc : undefined,
        subject: input.subject,
        text: input.text,
      })
    } finally {
      if (mailer) {
        try {
          await mailer.close()
        } catch {
          // Delivery has already completed or failed; closing is best effort.
        }
      }
    }
    await bindings.ANEKO_KV.put(
      idempotencyKey,
      JSON.stringify({ hash: payloadHash, status: 'sent', createdAt: Date.now() } satisfies IdempotencyRecord),
      { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
    )
    return { sent: true as const, idempotencyKey: input.idempotencyKey, replayed: false }
  } catch (error) {
    try {
      await bindings.ANEKO_KV.put(
        idempotencyKey,
        JSON.stringify({ hash: payloadHash, status: 'unknown', createdAt: Date.now() } satisfies IdempotencyRecord),
        { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
      )
    } catch {
      // The original pending record remains as a conservative duplicate-send guard.
    }
    throw new MailServiceConflictError('Mail delivery status is unknown; check Sent before retrying')
  }
}
