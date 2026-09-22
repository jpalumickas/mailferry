import React from 'react'
import { render } from '@react-email/render'
import type { Options } from '../types.js'
import { MailServerValidationError } from '../errors.js'
import { createEmailI18n, getAvailableLocales } from './translations.js'

type Props = {
  options: Pick<
    Options,
    'templates' | 'availableLocales' | 'supportedLocales' | 'translations'
  >
  template: string
  locale: string
  data: any
}

export const renderEmailTemplate = async ({
  options,
  template,
  locale,
  data,
}: Props) => {
  const Template = options.templates[template]

  if (!Template) {
    throw new MailServerValidationError(`Template ${template} not found`)
  }

  if (!getAvailableLocales(options).includes(locale)) {
    throw new MailServerValidationError(`Locale ${locale} not supported`)
  }

  const i18n =
    options.translations && !('templateName' in Template)
      ? await createEmailI18n(options.translations, locale, template)
      : undefined
  const content = <Template locale={locale} data={data} i18n={i18n} />

  const html = await render(content, {
    pretty: true,
  })

  const text = await render(content, {
    plainText: true,
  })

  return { html: html.replace(/react-email-/g, ''), text }
}
