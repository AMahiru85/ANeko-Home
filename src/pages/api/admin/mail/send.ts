import type { APIRoute } from 'astro'
import { assertMailHostsAllowed, readMailConfiguration } from '../../../../utils/mail-config'
import { parseSendMailInput, sendMail } from '../../../../utils/mail-service'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../utils/mail-api'

export const prerender = false

export const POST: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  assertMailHostsAllowed(bindings, configuration)
  const input = parseSendMailInput(await readMailJson(request))
  return mailSuccess(await sendMail(bindings, configuration, request, input))
})
