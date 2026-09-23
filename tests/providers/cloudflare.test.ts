import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest'
import {
  CloudflareRestApiError,
  createCloudflareBindingProvider,
  createCloudflareRestProvider,
} from '../../src/providers/cloudflare/index.js'
import type { CloudflareEmailBinding } from '../../src/providers/cloudflare/index.js'

expectTypeOf<SendEmail>().toExtend<CloudflareEmailBinding>()

afterEach(() => vi.unstubAllGlobals())

describe('createCloudflareBindingProvider', () => {
  test('sends rendered HTML and text with named addresses through the binding', async () => {
    const result = { messageId: 'cf-message-id' }
    const send = vi.fn(async () => result)
    const provider = createCloudflareBindingProvider({ send })

    await expect(
      provider.sendEmail({
        data: {
          from: 'Company Inc <company@example.com>',
          to: 'John Doe <john@example.com>',
          subject: 'Welcome',
          html: '<h1>Welcome</h1>',
          text: 'Welcome',
        },
      })
    ).resolves.toBe(result)

    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: { name: 'Company Inc', email: 'company@example.com' },
      to: { name: 'John Doe', email: 'john@example.com' },
      subject: 'Welcome',
      html: '<h1>Welcome</h1>',
      text: 'Welcome',
    })
  })

  test('accepts plain addresses and passes through Cloudflare errors', async () => {
    const error = Object.assign(new Error('Sender domain not verified'), {
      code: 'E_SENDER_NOT_VERIFIED',
    })
    const send = vi.fn().mockRejectedValue(error)
    const provider = createCloudflareBindingProvider({ send })

    await expect(
      provider.sendEmail({
        data: {
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Welcome',
          html: '<h1>Welcome</h1>',
        },
      })
    ).rejects.toBe(error)

    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Welcome',
      html: '<h1>Welcome</h1>',
    })
  })

  test('converts optional cc and bcc addresses', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-message-id' }))
    const provider = createCloudflareBindingProvider({ send })

    await provider.sendEmail({
      data: {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        cc: 'Copy <copy@example.com>',
        bcc: 'secret@example.com',
        subject: 'Welcome',
        html: '<h1>Welcome</h1>',
      },
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: { name: 'Copy', email: 'copy@example.com' },
        bcc: 'secret@example.com',
      })
    )
  })
})

describe('createCloudflareRestProvider', () => {
  const credentials = { accountId: 'account-123', apiToken: 'token-456' }
  const data = {
    from: 'Company Inc <company@example.com>',
    to: 'John Doe <john@example.com>',
    subject: 'Welcome',
    html: '<h1>Welcome</h1>',
    text: 'Welcome',
  }

  test('posts a structured email with bearer authentication and returns delivery status', async () => {
    const result = {
      delivered: ['john@example.com'],
      permanent_bounces: [],
      queued: [],
    }
    const fetch = vi.fn(async () =>
      Response.json({ success: true, errors: [], messages: [], result })
    )
    vi.stubGlobal('fetch', fetch)

    await expect(
      createCloudflareRestProvider(credentials).sendEmail({ data })
    ).resolves.toStrictEqual(result)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account-123/email/sending/send'
    )
    expect(init.method).toBe('POST')
    expect(init.headers).toStrictEqual({
      Authorization: 'Bearer token-456',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(init.body as string)).toStrictEqual({
      from: { name: 'Company Inc', email: 'company@example.com' },
      to: { name: 'John Doe', email: 'john@example.com' },
      subject: 'Welcome',
      html: '<h1>Welcome</h1>',
      text: 'Welcome',
    })
  })

  test('rejects non-success HTTP responses with Cloudflare error details', async () => {
    const errors = [
      { code: 10102, message: 'email.sending.error.authentication.forbidden' },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ success: false, errors, result: null }, { status: 403 })
      )
    )

    await expect(
      createCloudflareRestProvider(credentials).sendEmail({ data })
    ).rejects.toMatchObject({
      name: 'CloudflareRestApiError',
      status: 403,
      errors,
    } satisfies Partial<CloudflareRestApiError>)
  })

  test('rejects a failed API envelope even when HTTP status is 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ success: false, errors: [], result: null })
      )
    )

    await expect(
      createCloudflareRestProvider(credentials).sendEmail({ data })
    ).rejects.toBeInstanceOf(CloudflareRestApiError)
  })

  test('rejects an invalid response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not JSON', { status: 502 }))
    )

    await expect(
      createCloudflareRestProvider(credentials).sendEmail({ data })
    ).rejects.toMatchObject({ status: 502, errors: [] })
  })
})
