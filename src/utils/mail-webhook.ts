import type { MailWebhookConfiguration } from './mail-config'
import { MailServiceInputError, parseSendMailInput, type SendMailInput } from './mail-service'
import { MAIL_SUBJECT_MAX_LENGTH, MAIL_TEXT_MAX_LENGTH } from './mail-constants'

const encoder = new TextEncoder()
const TEMPLATE_PATTERN = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/

type JsonRecord = Record<string, unknown>

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function verifyWebhookAuthorization(request: Request, expectedToken: string) {
  const authorization = request.headers.get('Authorization') || ''
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim())
  if (!match || !expectedToken) return false
  const [providedHash, expectedHash] = await Promise.all([
    digest(match[1]),
    digest(expectedToken),
  ])
  let difference = 0
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index]
  }
  return difference === 0
}

function webhookData(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MailServiceInputError('Request body must be a JSON object')
  }
  return value as JsonRecord
}

function pathValue(data: JsonRecord, path: string) {
  let current: unknown = data
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined
    current = (current as JsonRecord)[segment]
  }
  return current
}

function serializedTemplateValue(value: unknown) {
  try {
    return JSON.stringify(value) || ''
  } catch {
    throw new MailServiceInputError('Webhook data cannot be serialized')
  }
}

function templateValue(value: unknown) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return serializedTemplateValue(value)
}

function renderTemplate(
  template: string,
  data: JsonRecord,
  maxLength: number,
  field: 'subject' | 'text',
) {
  const chunks: string[] = []
  let outputLength = 0
  let sourceOffset = 0
  let match: RegExpExecArray | null

  const append = (value: string) => {
    if (value.length > maxLength - outputLength) {
      throw new MailServiceInputError(`Rendered webhook ${field} is too long`)
    }
    chunks.push(value)
    outputLength += value.length
  }

  TEMPLATE_PATTERN.lastIndex = 0
  while ((match = TEMPLATE_PATTERN.exec(template)) !== null) {
    append(template.slice(sourceOffset, match.index))
    append(match[1] === 'json'
      ? serializedTemplateValue(data)
      : templateValue(pathValue(data, match[1])))
    sourceOffset = match.index + match[0].length
  }
  append(template.slice(sourceOffset))
  return chunks.join('')
}

function idempotencyKey(request: Request) {
  const supplied = request.headers.get('Idempotency-Key')?.trim()
  if (!supplied) return `webhook:${crypto.randomUUID()}`
  if (!IDEMPOTENCY_KEY_PATTERN.test(supplied)) {
    throw new MailServiceInputError('Idempotency-Key must be 8 to 120 letters, digits, dots, underscores, colons, or hyphens')
  }
  return `webhook:${supplied}`
}

export function webhookMailInput(
  configuration: MailWebhookConfiguration,
  request: Request,
  value: unknown,
): SendMailInput {
  const data = webhookData(value)
  return parseSendMailInput({
    idempotencyKey: idempotencyKey(request),
    to: configuration.to,
    cc: configuration.cc,
    subject: renderTemplate(
      configuration.subject,
      data,
      MAIL_SUBJECT_MAX_LENGTH,
      'subject',
    ),
    text: renderTemplate(configuration.text, data, MAIL_TEXT_MAX_LENGTH, 'text'),
  })
}
