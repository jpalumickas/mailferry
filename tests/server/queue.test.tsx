import { describe, test, expect, vi } from 'vitest'
import { createQueue } from '../../src/server/queue'
import { MailServerValidationError } from '../../src/errors'
import type { Options } from '../../src/types'

type Body = {
  template: string
  locale: string
  to: { email: string; name: string }
  subject?: string | null
  data?: Record<string, string | number>
}

const createTestQueue = (overrides: Partial<Options> = {}) => {
  const sendEmail = vi.fn(async () => ({ id: 'mailgun-id' }))

  const queue = createQueue(() => ({
    provider: { sendEmail },
    supportedLocales: ['en'],
    from: { email: 'company@example.com', name: 'Company Inc' },
    templates: { welcome: () => <div>Welcome</div> },
    ...overrides,
  }))

  return { queue, sendEmail }
}

const batchOf = (...bodies: Body[]) =>
  ({
    messages: bodies.map((body) => ({ body, ack: vi.fn(), retry: vi.fn() })),
    retryAll: vi.fn(),
  }) as any

const message: Body = {
  template: 'welcome',
  locale: 'en',
  to: { email: 'john@example.com', name: 'John Doe' },
  subject: 'Welcome to our platform',
}

describe('createQueue', () => {
  test('sends an email for every message in the batch', async () => {
    const { queue, sendEmail } = createTestQueue()

    const batch = batchOf(message, {
      ...message,
      to: { email: 'jane@example.com', name: 'Jane Doe' },
    })

    await queue(batch, {})

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({ to: 'John Doe <john@example.com>' }),
    })
    expect(batch.messages[0].ack).toHaveBeenCalledOnce()
    expect(batch.messages[1].ack).toHaveBeenCalledOnce()
  })

  test('falls back to createSubject when the message has no subject', async () => {
    const createSubject = vi.fn(async () => 'Generated subject')
    const { queue, sendEmail } = createTestQueue({ createSubject })

    await queue(batchOf({ ...message, subject: null }), {})

    expect(createSubject).toHaveBeenCalledWith({
      locale: 'en',
      template: 'welcome',
    })
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({ subject: 'Generated subject' }),
    })
  })

  test('falls back to createSubject when the subject is whitespace', async () => {
    const createSubject = vi.fn(async () => 'Generated subject')
    const { queue, sendEmail } = createTestQueue({ createSubject })

    await queue(batchOf({ ...message, subject: '  ' }), {})

    expect(createSubject).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({ subject: 'Generated subject' }),
    })
  })

  test('throws when the subject is missing and no onError is given', async () => {
    const { queue } = createTestQueue()

    await expect(
      queue(batchOf({ ...message, subject: '  ' }), {})
    ).rejects.toThrow(MailServerValidationError)
  })

  test('reports errors to onError instead of throwing', async () => {
    const onError = vi.fn()
    const { queue } = createTestQueue({ onError })
    const batch = batchOf({ ...message, subject: null })

    await expect(queue(batch, {})).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(MailServerValidationError)
    expect(batch.messages[0].retry).toHaveBeenCalledOnce()
    expect(batch.messages[0].ack).not.toHaveBeenCalled()
  })

  test('rethrows when the batch itself cannot be read', async () => {
    const { queue } = createTestQueue()

    await expect(queue({ messages: null } as any, {})).rejects.toThrow(
      TypeError
    )
  })

  test('reports an unreadable batch to onError', async () => {
    const onError = vi.fn()
    const { queue } = createTestQueue({ onError })
    const batch = { messages: null, retryAll: vi.fn() } as any

    await expect(queue(batch, {})).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
    expect(batch.retryAll).toHaveBeenCalledOnce()
  })

  test('keeps processing the batch after a failed message', async () => {
    const onError = vi.fn()
    const { queue, sendEmail } = createTestQueue({ onError })
    const batch = batchOf({ ...message, subject: null }, message)

    await queue(batch, {})

    expect(onError).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(batch.messages[0].retry).toHaveBeenCalledOnce()
    expect(batch.messages[1].ack).toHaveBeenCalledOnce()
  })

  test('retries a provider failure and waits for an async onError callback', async () => {
    const onError = vi.fn(async () => {})
    const { queue, sendEmail } = createTestQueue({ onError })
    const error = new Error('Mailgun unavailable')
    sendEmail.mockRejectedValueOnce(error)
    const batch = batchOf(message)

    await queue(batch, {})

    expect(onError).toHaveBeenCalledWith(error)
    expect(batch.messages[0].retry).toHaveBeenCalledOnce()
    expect(batch.messages[0].ack).not.toHaveBeenCalled()
  })

  test('acknowledges earlier sends before a later message fails', async () => {
    const { queue, sendEmail } = createTestQueue()
    const batch = batchOf(message, { ...message, subject: null })

    await expect(queue(batch, {})).rejects.toThrow(MailServerValidationError)

    expect(sendEmail).toHaveBeenCalledOnce()
    expect(batch.messages[0].ack).toHaveBeenCalledOnce()
    expect(batch.messages[1].ack).not.toHaveBeenCalled()
  })
})
