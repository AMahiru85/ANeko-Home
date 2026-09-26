import type { APIRoute } from 'astro'
import {
  assertMailHostsAllowed,
  readMailConfiguration,
  readMailWebhookStore,
  publicMailWebhook,
} from '../../../utils/mail-config'
import { getBindings } from '../../../utils/cloudflare'
import { mailError, mailExceptionResponse, mailSuccess, readMailJson } from '../../../utils/mail-api'
import { sendMail } from '../../../utils/mail-service'
import { verifyWebhookAuthorization, webhookMailInput } from '../../../utils/mail-webhook'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const bindings = getBindings()
    const store = await readMailWebhookStore(bindings)
    const resolved = publicMailWebhook(store, 'default')
    if (!resolved) return mailError('未找到 Webhook 配置', 404)
    const webhook = { ...resolved, revision: store.revision, updatedAt: store.updatedAt }
    const body = await readMailJson(request)
    if (!await verifyWebhookAuthorization(request, webhook.token, body)) {
      return mailError('访问令牌无效或缺失', 401, { 'WWW-Authenticate': 'Bearer' })
    }
    if (!webhook.enabled) return mailError('Webhook 已停用', 503)

    const configuration = await readMailConfiguration(bindings)
    assertMailHostsAllowed(bindings, configuration)

    const input = webhookMailInput(webhook, request, body)
    return mailSuccess(await sendMail(bindings, configuration, request, input))
  } catch (error) {
    return mailExceptionResponse(error)
  }
}
