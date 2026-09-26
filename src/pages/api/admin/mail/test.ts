import type { APIRoute } from 'astro'
import { resolveMailDraft } from '../../../../utils/mail-config'
import { MailServiceInputError, testMailConnection } from '../../../../utils/mail-service'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../utils/mail-api'

export const prerender = false

export const POST: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const value = await readMailJson(request)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MailServiceInputError('body must be an object')
  }
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !['target', 'config'].includes(key))
    || (input.target !== 'imap' && input.target !== 'smtp')) {
    throw new MailServiceInputError('body.target must be imap or smtp')
  }
  const configuration = await resolveMailDraft(bindings, input.config, true)
  return mailSuccess(await testMailConnection(configuration, input.target))
})
