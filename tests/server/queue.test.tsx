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
  ({ messages: bodies.map((body) => ({ body })) }) as any

const message: Body = {
  template: 'welcome',
  locale: 'en',
  to: { email: 'john@example.com', name: 'John Doe' },
  subject: 'Welcome to our platform',
}

describe('createQueue', () => {
  test('sends an email for every message in the batch', async () => {
    const { queue, sendEmail } = createTestQueue()

    await queue(
      batchOf(message, {
        ...message,
        to: { email: 'jane@example.com', name: 'Jane Doe' },
      }),
      {}
    )

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({ to: 'John Doe <john@example.com>' }),
    })
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

  test('throws when the subject is missing and no onError is given', async () => {
    const { queue } = createTestQueue()

    await expect(
      queue(batchOf({ ...message, subject: '  ' }), {})
    ).rejects.toThrow(MailServerValidationError)
  })

  test('reports errors to onError instead of throwing', async () => {
    const onError = vi.fn()
    const { queue } = createTestQueue({ onError })

    await expect(
      queue(batchOf({ ...message, subject: null }), {})
    ).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(MailServerValidationError)
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

    await expect(queue({ messages: null } as any, {})).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
  })

  test('keeps processing the batch after a failed message', async () => {
    const onError = vi.fn()
    const { queue, sendEmail } = createTestQueue({ onError })

    await queue(batchOf({ ...message, subject: null }, message), {})

    expect(onError).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledOnce()
  })
})
