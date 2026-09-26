import type { APIRoute } from 'astro'
import { assertMailHostsAllowed, readMailConfiguration } from '../../../../../utils/mail-config'
import {
  getMailMessage,
  parseMailMessageTarget,
  setMailMessageSeen,
} from '../../../../../utils/mail-service'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async ({ request, params }, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  assertMailHostsAllowed(bindings, configuration)
  const target = parseMailMessageTarget(new URL(request.url), params.uid)
  return mailSuccess(await getMailMessage(configuration, target))
})

export const PATCH: APIRoute = (context) => adminMailRoute(context, async ({ request, params }, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  assertMailHostsAllowed(bindings, configuration)
  const target = parseMailMessageTarget(new URL(request.url), params.uid)
  return mailSuccess(await setMailMessageSeen(configuration, target, await readMailJson(request)))
})
