import { describe, expect, test, vi } from 'vitest'
import { createClient, MailferryHttpError } from '../src/client'
import { createHandler } from '../src/server'

const createFixture = (accessToken = 'test-token') => {
  const sendEmail = vi.fn(async () => ({ id: 'sent-id' }))
  const handler = createHandler(() => ({
    accessToken: 'test-token',
    provider: { sendEmail },
    supportedLocales: ['en'],
    from: { email: 'company@example.com' },
    templates: {
      welcome: ({ data }: any) => <div>Welcome {data.name}</div>,
    },
  }))
  const fetch: typeof globalThis.fetch = async (input, init) =>
    handler.fetch(new Request(input, init), {}, {} as ExecutionContext)
  const client = createClient({
    baseUrl: 'https://mail.example.com/',
    accessToken,
    fetch,
  })

  return { client, sendEmail }
}

describe('mailferry client', () => {
  test('sends a template through the HTTP handler', async () => {
    const { client, sendEmail } = createFixture()

    const result = await client.send({
      template: 'welcome',
      locale: 'en',
      to: { email: 'person@example.com' },
      subject: 'Welcome',
      data: { name: 'Person' },
    })

    expect(result).toMatchObject({
      success: true,
      subject: 'Welcome',
      response: { id: 'sent-id' },
    })
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  test('renders html and plain text through the HTTP handler', async () => {
    const { client } = createFixture()

    const html = await client.render({
      template: 'welcome',
      locale: 'en',
      format: 'html',
      data: { name: 'Person' },
    })
    const text = await client.render({
      template: 'welcome',
      locale: 'en',
      format: 'txt',
      data: { name: 'Person' },
    })

    expect(html).toContain('Welcome')
    expect(html).toContain('Person')
    expect(text).toBe('Welcome Person')
  })

  test('reports unauthorized responses with their status', async () => {
    const { client } = createFixture('wrong-token')

    await expect(
      client.render({ template: 'welcome', locale: 'en', format: 'html' })
    ).rejects.toMatchObject({
      name: 'MailferryHttpError',
      status: 401,
    } satisfies Partial<MailferryHttpError>)
  })
})
