import { describe, test, expect, vi, afterEach } from 'vitest'
import { sendMailgunEmail } from '../../src/providers/mailgun/sendMailgunEmail'
import { createMailgunProvider } from '../../src/providers/mailgun'
import { MailServerProviderError } from '../../src/errors'

const credentials = {
  apiKey: 'key-123',
  apiHost: 'api.example.net',
  domain: 'example.com',
}

const data = {
  from: 'Company Inc <company@example.com>',
  to: 'John Doe <john@example.com>',
  subject: 'Welcome to our platform',
  html: '<div>Welcome</div>',
  text: 'Welcome',
}

const mockFetch = (response: Partial<Response>) => {
  const fetch = vi.fn(async () => response as Response)
  vi.stubGlobal('fetch', fetch)

  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendMailgunEmail', () => {
  test('posts the email as url encoded form data', async () => {
    const fetch = mockFetch({
      ok: true,
      json: async () => ({ id: 'mailgun-id' }),
    })

    const result = await sendMailgunEmail({ ...credentials, data })

    expect(result).toStrictEqual({ id: 'mailgun-id' })
    expect(fetch).toHaveBeenCalledOnce()

    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]

    expect(url).toBe('https://api.example.net/v3/example.com/messages')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({
      Authorization: `Basic ${btoa('api:key-123')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    })

    const body = new URLSearchParams(options.body as string)
    expect(Object.fromEntries(body)).toStrictEqual(data)
  })

  test('throws a provider error when mailgun rejects the request', async () => {
    mockFetch({ ok: false, status: 401 })

    await expect(sendMailgunEmail({ ...credentials, data })).rejects.toThrow(
      new MailServerProviderError('Send email failed. Status: 401')
    )
  })
})

describe('createMailgunProvider', () => {
  test('forwards the credentials to mailgun', async () => {
    const fetch = mockFetch({
      ok: true,
      json: async () => ({ id: 'mailgun-id' }),
    })

    const provider = createMailgunProvider(credentials)
    const result = await provider.sendEmail({ data })

    expect(result).toStrictEqual({ id: 'mailgun-id' })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.net/v3/example.com/messages',
      expect.objectContaining({ method: 'POST' })
    )
  })

  test('rejects when mailgun rejects the request', async () => {
    mockFetch({ ok: false, status: 401 })

    const provider = createMailgunProvider(credentials)

    await expect(provider.sendEmail({ data })).rejects.toThrow(
      new MailServerProviderError('Send email failed. Status: 401')
    )
  })
})
