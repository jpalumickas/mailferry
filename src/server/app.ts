import { Hono } from 'hono'
import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import { renderEmailTemplate } from '../services/renderEmailTemplate.js'
import type { CreateOptions } from '../types.js'

type Data = {
  locale: string
  to: {
    email: string
    name: string
  }
  subject?: string | undefined | null
  data?: Record<string, string | number>
}

export const createApp = <Env extends object>(
  createOptions: CreateOptions<Env>
) => {
  const app = new Hono<{ Bindings: Env }>()

  app.post('/emails/:emailTemplate/render/:format', async (c) => {
    const options = createOptions({ env: c.env })
    const emailTemplate = c.req.param('emailTemplate')
    const format = c.req.param('format')
    const data = await c.req.json<Data>()

    const email = await renderEmailTemplate({
      options,
      template: emailTemplate,
      locale: data.locale,
      data: data.data || {},
    })

    if (format === 'txt') {
      return c.text(email.text)
    }

    return c.html(email.html)
  })

  app.post('/emails/:emailTemplate/send', async (c) => {
    const options = createOptions({ env: c.env })

    const contentType = c.req.header('content-type')
    if (
      !contentType ||
      !contentType.includes('application/json') ||
      c.req.method !== 'POST'
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await c.req.json<Data>()
    const emailTemplate = c.req.param('emailTemplate')

    if (!data?.to?.email || !data?.locale || !emailTemplate) {
      return new Response(JSON.stringify({ error: 'Invalid params' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const subject =
      data.subject?.trim() ||
      (options.createSubject
        ? await options.createSubject({
            locale: data.locale,
            template: emailTemplate,
          })
        : undefined)

    if (!subject?.trim()) {
      return new Response(JSON.stringify({ error: 'Subject is required' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sendEmailTemplate({
      options,
      data: {
        emailTemplate,
        subject,
        locale: data.locale,
        to: data.to,
        data: data.data || {},
      },
    })

    return c.json({ success: true, ...result })
  })

  return { app }
}
