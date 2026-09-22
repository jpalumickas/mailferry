import { describe, test, expect } from 'vitest'
import { renderEmailTemplate } from '../../src/services/renderEmailTemplate'
import { MailServerValidationError } from '../../src/errors'
import type { TranslatedEmailTemplateProps } from '../../src/types'

describe('renderEmailTemplate', () => {
  const options = {
    supportedLocales: ['en', 'es'],
    templates: {
      welcome: () => <div>Welcome</div>,
      greeting: ({ locale, data }: any) => (
        <div>{`Hello ${data.name} (${locale})`}</div>
      ),
      branded: () => <div className="react-email-body">Branded</div>,
    },
  }

  test('renders html and text', async () => {
    const email = await renderEmailTemplate({
      options,
      template: 'welcome',
      locale: 'en',
      data: {},
    })

    expect(email).toStrictEqual({
      html: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n<!--$-->\n<div>Welcome</div>\n<!--/$-->\n',
      text: 'Welcome',
    })
  })

  test('passes the locale and data to the template', async () => {
    const email = await renderEmailTemplate({
      options,
      template: 'greeting',
      locale: 'es',
      data: { name: 'Juan' },
    })

    expect(email.text).toBe('Hello Juan (es)')
    expect(email.html).toContain('<div>Hello Juan (es)</div>')
  })

  test('translates concurrent renders with the requested locales', async () => {
    const translatedOptions = {
      availableLocales: ['en', 'es'],
      translations: {
        greeting: {
          en: { title: 'Hello {{name}}' },
          es: { title: 'Hola {{name}}' },
        },
        common: {
          en: { footer: 'Thanks' },
          es: { footer: 'Gracias' },
        },
      },
      templates: {
        greeting: ({
          data,
          i18n,
        }: TranslatedEmailTemplateProps<{ name: string }>) => (
          <div>
            {i18n.t('title', { name: data.name })} — {i18n.t('common:footer')}
          </div>
        ),
      },
    }

    const [english, spanish] = await Promise.all([
      renderEmailTemplate({
        options: translatedOptions,
        template: 'greeting',
        locale: 'en',
        data: { name: 'Jane' },
      }),
      renderEmailTemplate({
        options: translatedOptions,
        template: 'greeting',
        locale: 'es',
        data: { name: 'Juan' },
      }),
    ])

    expect(english.text).toBe('Hello Jane — Thanks')
    expect(spanish.text).toBe('Hola Juan — Gracias')
  })

  test('rejects a missing translation for the requested locale', async () => {
    await expect(
      renderEmailTemplate({
        options: {
          availableLocales: ['en', 'es'],
          translations: { welcome: { en: { title: 'Welcome' } } },
          templates: { welcome: () => <div>Welcome</div> },
        },
        template: 'welcome',
        locale: 'es',
        data: {},
      })
    ).rejects.toThrow(
      'Translations for template welcome and locale es not found'
    )
  })

  test('strips the react-email- prefix from html', async () => {
    const email = await renderEmailTemplate({
      options,
      template: 'branded',
      locale: 'en',
      data: {},
    })

    expect(email.html).toContain('class="body"')
    expect(email.html).not.toContain('react-email-')
  })

  test('throws when the template is not found', async () => {
    const promise = renderEmailTemplate({
      options,
      template: 'missing',
      locale: 'en',
      data: {},
    })

    await expect(promise).rejects.toBeInstanceOf(MailServerValidationError)
    await expect(promise).rejects.toThrow('Template missing not found')
  })

  test('throws when the locale is not supported', async () => {
    const promise = renderEmailTemplate({
      options,
      template: 'welcome',
      locale: 'lt',
      data: {},
    })

    await expect(promise).rejects.toBeInstanceOf(MailServerValidationError)
    await expect(promise).rejects.toThrow('Locale lt not supported')
  })
})
