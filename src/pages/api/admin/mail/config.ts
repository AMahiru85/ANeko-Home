import type { APIRoute } from 'astro'
import {
  adminMailConfiguration,
  readMailConfiguration,
  saveMailConfiguration,
} from '../../../../utils/mail-config'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async (_context, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  return mailSuccess(adminMailConfiguration(configuration))
})

export const PUT: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const configuration = await saveMailConfiguration(bindings, await readMailJson(request))
  return mailSuccess(adminMailConfiguration(configuration))
})
