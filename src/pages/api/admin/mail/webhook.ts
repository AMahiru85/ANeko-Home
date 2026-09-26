import type { APIRoute } from 'astro'
import {
  adminMailWebhookStore,
  readMailWebhookStore,
  saveMailWebhookStore,
} from '../../../../utils/mail-config'
import { adminMailRoute, mailSuccess, readMailJson } from '../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async (_context, bindings) => {
  const store = await readMailWebhookStore(bindings)
  return mailSuccess(adminMailWebhookStore(store))
})

export const PUT: APIRoute = (context) => adminMailRoute(context, async ({ request }, bindings) => {
  const store = await saveMailWebhookStore(bindings, await readMailJson(request))
  return mailSuccess(adminMailWebhookStore(store))
})
