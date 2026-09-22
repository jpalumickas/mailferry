import { describe, test, expect, vi } from 'vitest'
import { createApp } from '../../src/server/app'

const createTestApp = () =>
  createApp(() => ({
    provider: { sendEmail: vi.fn() },
    accessToken: 'test-token',
    supportedLocales: ['en', 'es'],
    from: { email: 'company@example.com', name: 'Company Inc' },
    templates: {
      welcome: ({ locale, data }: any) => (
        <div>{`Welcome ${data.name} (${locale})`}</div>
      ),
    },
  }))

describe('POST /emails/:emailTemplate/render/:format', () => {
  const render = (format: string, body: unknown) => {
    const { app } = createTestApp()

    return app.request(`/emails/welcome/render/${format}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })
  }

  test('renders html', async () => {
    const res = await render('html', {
      locale: 'en',
      data: { name: 'John Doe' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<div>Welcome John Doe (en)</div>')
  })

  test('renders plain text', async () => {
    const res = await render('txt', {
      locale: 'es',
      data: { name: 'Juan' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toBe('Welcome Juan (es)')
  })

  test('defaults to empty data when none is given', async () => {
    const res = await render('txt', { locale: 'en' })

    expect(await res.text()).toBe('Welcome undefined (en)')
  })

  test('returns 422 for an unsupported locale', async () => {
    const res = await render('html', { locale: 'fr' })

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
  })

  test('returns 422 for a null body', async () => {
    const res = await render('html', null)

    expect(res.status).toBe(422)
    expect(await res.json()).toStrictEqual({ error: 'Invalid params' })
  })

  test('returns 400 for malformed JSON', async () => {
    const { app } = createTestApp()
    const res = await app.request('/emails/welcome/render/html', {
      method: 'POST',
      body: '{',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toStrictEqual({ error: 'Invalid JSON' })
  })

  test('requires a bearer token for rendering', async () => {
    const { app } = createTestApp()
    const res = await app.request('/emails/welcome/render/html', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toStrictEqual({ error: 'Unauthorized' })
  })

  test('renders without a bearer token when no access token is configured', async () => {
    const { app } = createApp(() => ({
      provider: { sendEmail: vi.fn() },
      supportedLocales: ['en'],
      from: { email: 'company@example.com' },
      templates: { welcome: () => <div>Welcome</div> },
    }))

    const res = await app.request('/emails/welcome/render/html', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<div>Welcome</div>')
  })
})
