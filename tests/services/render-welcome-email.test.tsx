import { describe, test, expect } from 'vitest'
import { renderEmailTemplate } from '../../src/services/renderEmailTemplate'
import { WelcomeEmail } from '../fixtures/WelcomeEmail'

describe('renderEmailTemplate with react-email components', () => {
  const options = {
    supportedLocales: ['en', 'es'],
    templates: { welcome: WelcomeEmail },
  }

  const data = {
    name: 'John Doe',
    confirmationUrl: 'https://example.com/confirm?token=abc123',
    supportEmail: 'support@example.com',
  }

  const render = (locale: string) =>
    renderEmailTemplate({ options, template: 'welcome', locale, data })

  test('renders the html', async () => {
    const { html } = await render('en')

    await expect(html).toMatchFileSnapshot(
      './__snapshots__/welcome-email.en.html'
    )
  })

  test('renders the plain text', async () => {
    const { text } = await render('en')

    await expect(text).toMatchFileSnapshot(
      './__snapshots__/welcome-email.en.txt'
    )
  })

  test('renders the localized html', async () => {
    const { html } = await render('es')

    await expect(html).toMatchFileSnapshot(
      './__snapshots__/welcome-email.es.html'
    )
  })

  test('renders the button as a link to the confirmation url', async () => {
    const { html, text } = await render('en')

    expect(html).toContain(`href="${data.confirmationUrl}"`)
    expect(html).toContain('Confirm email address')
    expect(text).toContain(data.confirmationUrl)
  })

  test('renders the localized copy', async () => {
    const { text } = await render('es')

    expect(text).toContain('Te damos la bienvenida'.toUpperCase())
    expect(text).toContain('Hola John Doe')
    expect(text).toContain('Confirmar correo')
  })
})
