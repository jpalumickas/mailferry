import { describe, test, expect, vi } from 'vitest'
import { createHandler } from '../src/index'

const createTestHandler = () => {
  const sendEmail = vi.fn(async () => ({ id: 'mailgun-id' }))

  const handler = createHandler(() => ({
    provider: { sendEmail },
    supportedLocales: ['en'],
    from: { email: 'company@example.com', name: 'Company Inc' },
    templates: { welcome: () => <div>Welcome</div> },
  }))

  return { handler, sendEmail }
}

describe('createHandler', () => {
  test('exposes a fetch handler backed by the app', async () => {
    const { handler, sendEmail } = createTestHandler()

    const res = await handler.fetch(
      new Request('https://mail.example.com/emails/welcome/send', {
        method: 'POST',
        body: JSON.stringify({
          locale: 'en',
          to: { email: 'john@example.com', name: 'John Doe' },
          subject: 'Welcome to our platform',
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
      {},
      {} as ExecutionContext
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  test('exposes a queue consumer', async () => {
    const { handler, sendEmail } = createTestHandler()

    await handler.queue(
      {
        messages: [
          {
            ack: vi.fn(),
            body: {
              template: 'welcome',
              locale: 'en',
              to: { email: 'john@example.com', name: 'John Doe' },
              subject: 'Welcome to our platform',
            },
          },
        ],
      } as any,
      {}
    )

    expect(sendEmail).toHaveBeenCalledOnce()
  })
})
