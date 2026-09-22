import { describe, expect, test, vi } from 'vitest'
import { render } from '@react-email/render'
import { createEmails, renderEmailTemplate } from '../src/server'

type WelcomeData = {
  inviter: { firstName: string }
  link: string
}

const emails = createEmails({
  availableLocales: ['en', 'lt'],
  translations: {
    welcome: {
      en: {
        subject: 'Welcome from {{inviter.firstName}}',
        title: 'Hello {{inviter.firstName}}',
      },
      lt: {
        subject: 'Sveiki nuo {{inviter.firstName}}',
        title: 'Labas {{inviter.firstName}}',
      },
    },
    common: {
      en: { footer: 'Thanks' },
      lt: { footer: 'Ačiū' },
    },
  },
})

const WelcomeEmail = emails.template<WelcomeData>('welcome', ({ t, data }) => (
  <div>
    <h1>{t('title', data)}</h1>
    <p>{t('common:footer')}</p>
    <a href={data.link}>Open</a>
  </div>
))
WelcomeEmail.PreviewProps = {
  locale: 'lt',
  data: { inviter: { firstName: 'Jonas' }, link: 'https://example.com' },
}

const data: WelcomeData = {
  inviter: { firstName: 'Jane' },
  link: 'https://example.com',
}

const send = (handler: ReturnType<typeof emails.createHandler>, body: object) =>
  handler.fetch(
    new Request('https://mail.example.com/emails/welcome/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {},
    {} as ExecutionContext
  )

describe('createEmails', () => {
  test('renders a template directly with JSON PreviewProps', async () => {
    const html = await render(<WelcomeEmail {...WelcomeEmail.PreviewProps!} />)
    expect(html).toContain('Labas Jonas')
    expect(html).toContain('Ačiū')
  })

  test('renders concurrent locales without leaking translations', async () => {
    const options = {
      templates: { welcome: WelcomeEmail },
      availableLocales: ['en', 'lt'],
      translations: {
        welcome: {
          en: {
            subject: 'Welcome from {{inviter.firstName}}',
            title: 'Hello {{inviter.firstName}}',
          },
          lt: {
            subject: 'Sveiki nuo {{inviter.firstName}}',
            title: 'Labas {{inviter.firstName}}',
          },
        },
        common: { en: { footer: 'Thanks' }, lt: { footer: 'Ačiū' } },
      },
    }
    const [en, lt] = await Promise.all([
      renderEmailTemplate({ options, template: 'welcome', locale: 'en', data }),
      renderEmailTemplate({ options, template: 'welcome', locale: 'lt', data }),
    ])
    expect(en.text).toContain('HELLO JANE')
    expect(en.text).toContain('Thanks')
    expect(lt.text).toContain('LABAS JANE')
    expect(lt.text).toContain('Ačiū')
  })

  test('uses the template metadata and translated subject in HTTP and queue sends', async () => {
    const sendEmail = vi.fn(async () => ({ id: 'sent' }))
    const handler = emails.createHandler(() => ({
      templates: [WelcomeEmail] as const,
      provider: { sendEmail },
      from: { email: 'hello@example.com' },
    }))
    const body = { locale: 'en', to: { email: 'jane@example.com' }, data }

    const response = await send(handler, body)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      subject: 'Welcome from Jane',
    })
    expect(sendEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: 'Welcome from Jane',
        text: expect.stringContaining('HELLO JANE'),
      }),
    })

    const message = {
      body: { ...body, template: 'welcome', locale: 'lt' },
      ack: vi.fn(),
      retry: vi.fn(),
    }
    await handler.queue({ messages: [message] } as any, {})
    expect(sendEmail).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        subject: 'Sveiki nuo Jane',
        text: expect.stringContaining('LABAS JANE'),
      }),
    })
    expect(message.ack).toHaveBeenCalledOnce()
  })

  test('prefers an explicit subject and then createSubject', async () => {
    const sendEmail = vi.fn(async () => ({}))
    const handler = emails.createHandler(() => ({
      templates: [WelcomeEmail],
      provider: { sendEmail },
      from: { email: 'hello@example.com' },
      createSubject: async () => 'Created',
    }))
    const body = { locale: 'en', to: { email: 'jane@example.com' }, data }
    expect(
      (
        (await (
          await send(handler, { ...body, subject: 'Explicit' })
        ).json()) as any
      ).subject
    ).toBe('Explicit')
    expect(((await (await send(handler, body)).json()) as any).subject).toBe(
      'Created'
    )
  })

  test('rejects unsupported or untranslated preview locales', async () => {
    await expect(
      render(<WelcomeEmail locale="fr" data={data} />)
    ).rejects.toThrow('Locale fr not supported')
    const partial = createEmails({
      availableLocales: ['en', 'lt'],
      translations: { welcome: { en: { title: 'Hello' } } },
    })
    const PartialEmail = partial.template('welcome', ({ t }) => (
      <div>{t('title')}</div>
    ))
    await expect(
      render(<PartialEmail locale="lt" data={{}} />)
    ).rejects.toThrow(
      'Translations for template welcome and locale lt not found'
    )
  })

  test('rejects duplicate names in a handler', async () => {
    const handler = emails.createHandler(() => ({
      templates: [WelcomeEmail, WelcomeEmail],
      provider: { sendEmail: async () => ({}) },
      from: { email: 'hello@example.com' },
    }))
    const response = await send(handler, {
      locale: 'en',
      to: { email: 'jane@example.com' },
      data,
    })
    expect(response.status).toBe(422)
  })
})
