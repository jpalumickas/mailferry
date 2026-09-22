import { Hono } from 'hono'
import { ZodError } from 'zod'
import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import { renderEmailTemplate } from '../services/renderEmailTemplate.js'
import { MailServerValidationError } from '../errors.js'
import { tokensMatch } from '../utils/tokensMatch.js'
import type { CreateOptions, Options } from '../types.js'

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
  const app = new Hono<{ Bindings: Env; Variables: { options: Options } }>()

  app.use('/emails/*', async (c, next) => {
    const options = createOptions({ env: c.env })
    const authorization = c.req.header('authorization')
    const provided = /^Bearer ([^\s]+)$/i.exec(authorization || '')?.[1]

    if (
      options.accessToken &&
      (!provided || !(await tokensMatch(provided, options.accessToken)))
    ) {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('options', options)
    await next()
  })

  app.onError((error, c) => {
    if (
      error instanceof ZodError ||
      error instanceof MailServerValidationError
    ) {
      return c.json({ error: 'Invalid params' }, 422)
    }

    console.error(error)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  app.post('/emails/:emailTemplate/render/:format', async (c) => {
    const options = c.get('options')
    const emailTemplate = c.req.param('emailTemplate')
    const format = c.req.param('format')
    let data: Data
    try {
      data = await c.req.json<Data>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    if (!data || typeof data !== 'object') {
      return c.json({ error: 'Invalid params' }, 422)
    }

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
    const options = c.get('options')

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

    let data: Data
    try {
      data = await c.req.json<Data>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const emailTemplate = c.req.param('emailTemplate')

    if (
      typeof data?.to?.email !== 'string' ||
      !data.to.email ||
      typeof data.locale !== 'string' ||
      !data.locale ||
      (data.subject != null && typeof data.subject !== 'string') ||
      !emailTemplate
    ) {
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
