import type { APIRoute } from 'astro'
import { assertMailHostsAllowed, readMailConfiguration } from '../../../../../utils/mail-config'
import { listMailMessages, parseMailListOptions } from '../../../../../utils/mail-service'
import { adminMailRoute, mailSuccess } from '../../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  assertMailHostsAllowed(bindings, configuration)
  return mailSuccess(await listMailMessages(configuration, parseMailListOptions(new URL(request.url))))
})
