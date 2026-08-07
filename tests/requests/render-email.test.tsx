import { describe, test, expect, vi } from 'vitest'
import { createApp } from '../../src/server/app'

const createTestApp = () =>
  createApp(() => ({
    provider: { sendEmail: vi.fn() },
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
      headers: { 'Content-Type': 'application/json' },
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
})
