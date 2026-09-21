import { describe, test, expect, vi } from 'vitest'
import { createApp } from '../../src/server/app'
import { createMailgunProvider } from '../../src/providers/mailgun'

describe('Example', () => {
  const { app } = createApp(() => ({
    accessToken: 'test-token',
    provider: createMailgunProvider({
      apiKey: 'test',
      domain: 'example.com',
      apiHost: 'example.net',
    }),
    supportedLocales: ['en', 'es'],
    from: {
      email: 'company@example.com',
      name: 'Company Inc',
    },
    templates: {
      welcome: () => <div>Welcome</div>,
    },
  }))

  test('POST /emails/welcome/send returns the Mailgun response', async () => {
    const fetch = vi.fn(
      async () =>
        ({ ok: true, json: async () => ({ id: 'mailgun-id' }) }) as Response
    )
    vi.stubGlobal('fetch', fetch)

    const data = {
      locale: 'en',
      to: {
        email: 'john@example.com',
        name: 'John Doe',
      },
      subject: 'Welcome to our platform',
      data: { token: 'test' },
    }
    try {
      const res = await app.request('/emails/welcome/send', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      })
      expect(res.status).toBe(200)

      const result = {
        html: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n<!--$-->\n<div>Welcome</div>\n<!--/$-->\n',
        response: { id: 'mailgun-id' },
        subject: 'Welcome to our platform',
        success: true,
        text: 'Welcome',
      }

      expect(await res.json()).toStrictEqual(result)
      expect(fetch).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
