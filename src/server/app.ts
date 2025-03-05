import { Hono } from 'hono'
import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import { renderEmailTemplate } from '../services/renderEmailTemplate.js'
import { Options } from '../types.js'

type Data = {
  locale: string
  to: {
    email: string
    name: string
  }
  data?: Record<string, string | number>
}

export const createApp = (options: Options) => {
  const app = new Hono()

  app.post('/emails/:emailTemplate/render/:format', async (c) => {
    const emailTemplate = c.req.param('emailTemplate')
    const format = c.req.param('format')
    const data = await c.req.json<Data>()

    const email = await renderEmailTemplate({
      options,
      template: emailTemplate,
      locale: data.locale,
      data: data.data || {},
      subject: 'TODO',
    })

    if (format === 'txt') {
      return c.text(email.text)
    }

    return c.html(email.html)
  })

  app.post('/emails/:emailTemplate/send', async (c) => {
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

    const result = await sendEmailTemplate({
      options,
      data: {
        emailTemplate,
        locale: data.locale,
        to: data.to,
        data: data.data || {},
      },
    })

    return c.json({ success: true, ...result })
  })

  return { app }
}
