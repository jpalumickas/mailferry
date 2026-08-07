import { describe, test, expect, vi } from 'vitest'
import { createApp } from '../../src/server/app'
import type { Options } from '../../src/types'

const createTestApp = (overrides: Partial<Options> = {}) => {
  const sendEmail = vi.fn(async () => ({ id: 'mailgun-id' }))

  const { app } = createApp(() => ({
    provider: { sendEmail },
    supportedLocales: ['en'],
    from: { email: 'company@example.com', name: 'Company Inc' },
    templates: { welcome: () => <div>Welcome</div> },
    ...overrides,
  }))

  return { app, sendEmail }
}

const body = {
  locale: 'en',
  to: { email: 'john@example.com', name: 'John Doe' },
  subject: 'Welcome to our platform',
}

const send = (
  app: ReturnType<typeof createTestApp>['app'],
  init: RequestInit
) => app.request('/emails/welcome/send', { method: 'POST', ...init })

describe('POST /emails/:emailTemplate/send', () => {
  test('rejects a request without a json content type', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await send(app, { body: JSON.stringify(body) })

    expect(res.status).toBe(400)
    expect(await res.json()).toStrictEqual({ error: 'Invalid request' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('rejects a request without a recipient email', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await send(app, {
      body: JSON.stringify({ ...body, to: { name: 'John Doe' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('rejects a request without a locale', async () => {
    const { app } = createTestApp()

    const res = await send(app, {
      body: JSON.stringify({ ...body, locale: undefined }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
  })

  test('rejects a request without a subject when none can be created', async () => {
    const { app } = createTestApp()

    const res = await send(app, {
      body: JSON.stringify({ ...body, subject: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Subject is required' })
  })

  test('falls back to createSubject when no subject is given', async () => {
    const createSubject = vi.fn(async () => 'Generated subject')
    const { app, sendEmail } = createTestApp({ createSubject })

    const res = await send(app, {
      body: JSON.stringify({ ...body, subject: null }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(createSubject).toHaveBeenCalledWith({
      locale: 'en',
      template: 'welcome',
    })
    expect(await res.json()).toMatchObject({
      success: true,
      subject: 'Generated subject',
    })
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  test('passes the rendered email to the provider', async () => {
    const { app, sendEmail } = createTestApp()

    await send(app, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(sendEmail).toHaveBeenCalledWith({
      data: {
        from: 'Company Inc <company@example.com>',
        to: 'John Doe <john@example.com>',
        subject: 'Welcome to our platform',
        html: expect.stringContaining('<div>Welcome</div>'),
        text: 'Welcome',
      },
    })
  })
})
