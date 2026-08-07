import { describe, test, expect, vi } from 'vitest'
import { sendEmailTemplate } from '../../src/services/sendEmailTemplate'
import type { Options } from '../../src/types'

const createOptions = (overrides: Partial<Options> = {}): Options => ({
  provider: { sendEmail: vi.fn(async () => ({ id: 'mailgun-id' })) },
  supportedLocales: ['en'],
  from: { email: 'company@example.com', name: 'Company Inc' },
  templates: { welcome: () => <div>Welcome</div> },
  ...overrides,
})

const data = {
  emailTemplate: 'welcome',
  locale: 'en',
  to: { email: 'john@example.com', name: 'John Doe' },
  subject: 'Welcome to our platform',
  data: {},
}

describe('sendEmailTemplate', () => {
  test('formats named senders and recipients', async () => {
    const options = createOptions()

    await sendEmailTemplate({ options, data })

    expect(options.provider.sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({
        from: 'Company Inc <company@example.com>',
        to: 'John Doe <john@example.com>',
      }),
    })
  })

  test('falls back to bare addresses when no name is given', async () => {
    const options = createOptions({ from: { email: 'company@example.com' } })

    await sendEmailTemplate({
      options,
      data: { ...data, to: { email: 'john@example.com' } },
    })

    expect(options.provider.sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({
        from: 'company@example.com',
        to: 'john@example.com',
      }),
    })
  })

  test('returns the provider response alongside the rendered email', async () => {
    const options = createOptions()

    const result = await sendEmailTemplate({ options, data })

    expect(result).toStrictEqual({
      response: { id: 'mailgun-id' },
      subject: 'Welcome to our platform',
      text: 'Welcome',
      html: expect.stringContaining('<div>Welcome</div>'),
    })
  })

  test('rejects an invalid recipient email', async () => {
    const options = createOptions()

    await expect(
      sendEmailTemplate({
        options,
        data: { ...data, to: { email: 'not-an-email' } },
      })
    ).rejects.toThrow('Invalid email address')

    expect(options.provider.sendEmail).not.toHaveBeenCalled()
  })
})
