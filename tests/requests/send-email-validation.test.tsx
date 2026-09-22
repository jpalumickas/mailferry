import { describe, test, expect, vi } from 'vitest'
import { createApp } from '../../src/server/app'
import type { Options } from '../../src/types'

const createTestApp = (overrides: Partial<Options> = {}) => {
  const sendEmail = vi.fn(async () => ({ id: 'mailgun-id' }))

  const { app } = createApp(() => ({
    provider: { sendEmail },
    accessToken: 'test-token',
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
) => {
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer test-token')
  return app.request('/emails/welcome/send', {
    method: 'POST',
    ...init,
    headers,
  })
}

describe('POST /emails/:emailTemplate/send', () => {
  test('rejects requests without a bearer token', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await app.request('/emails/welcome/send', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(await res.json()).toStrictEqual({ error: 'Unauthorized' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('rejects an incorrect bearer token', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await app.request('/emails/welcome/send', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: 'Bearer wrong-token',
        'Content-Type': 'application/json',
      },
    })

    expect(res.status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('allows requests without a bearer token when no access token is configured', async () => {
    const { app, sendEmail } = createTestApp({ accessToken: undefined })

    const res = await app.request('/emails/welcome/send', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledOnce()
  })

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

  test('returns 422 for an invalid recipient email', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await send(app, {
      body: JSON.stringify({ ...body, to: { email: 'not-an-email' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('returns 422 for a non-string subject', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await send(app, {
      body: JSON.stringify({ ...body, subject: 123 }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('returns 400 for malformed JSON', async () => {
    const { app, sendEmail } = createTestApp()

    const res = await send(app, {
      body: '{',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toStrictEqual({ error: 'Invalid JSON' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('returns 500 for an unexpected provider failure', async () => {
    const error = new Error('Provider unavailable')
    const sendEmail = vi.fn(async () => {
      throw error
    })
    const { app } = createTestApp({ provider: { sendEmail } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const res = await send(app, {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(500)
      expect(await res.json()).toStrictEqual({ error: 'Internal Server Error' })
      expect(log).toHaveBeenCalledWith(error)
    } finally {
      log.mockRestore()
    }
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

  test('uses the translated subject when no subject is given', async () => {
    const { app, sendEmail } = createTestApp({
      availableLocales: ['en', 'lt'],
      supportedLocales: undefined,
      translations: {
        welcome: {
          en: { subject: 'Welcome {{name}}', title: 'Hello' },
          lt: { subject: 'Sveiki, {{name}}', title: 'Labas' },
        },
      },
      templates: {
        welcome: ({ i18n }: any) => <div>{i18n.t('title')}</div>,
      },
    })

    const res = await send(app, {
      body: JSON.stringify({
        ...body,
        locale: 'lt',
        subject: null,
        data: { name: 'Jonas' },
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: 'Sveiki, Jonas',
        text: 'Labas',
      }),
    })
  })

  test('rejects a missing translated subject', async () => {
    const { app, sendEmail } = createTestApp({
      availableLocales: ['en'],
      translations: { welcome: { en: { title: 'Hello' } } },
    })

    const res = await send(app, {
      body: JSON.stringify({ ...body, subject: null }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(422)
    expect(sendEmail).not.toHaveBeenCalled()
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
