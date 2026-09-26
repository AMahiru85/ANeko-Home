import type { APIRoute } from 'astro'
import { readMailConfiguration, assertMailHostsAllowed } from '../../../../utils/mail-config'
import { listMailFolders } from '../../../../utils/mail-service'
import { adminMailRoute, mailSuccess } from '../../../../utils/mail-api'

export const prerender = false

export const GET: APIRoute = (context) => adminMailRoute(context, async (_context, bindings) => {
  const configuration = await readMailConfiguration(bindings)
  assertMailHostsAllowed(bindings, configuration)
  return mailSuccess(await listMailFolders(configuration))
})
