import React from 'react'
import { render } from '@react-email/render'
import type { Options } from '../types.js'
import { MailServerValidationError } from '../errors.js'

type Props = {
  options: Pick<Options, 'templates' | 'supportedLocales'>
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

  if (!options.supportedLocales.includes(locale)) {
    throw new MailServerValidationError(`Locale ${locale} not supported`)
  }

  const html = await render(<Template locale={locale} data={data} />, {
    pretty: true,
  })

  const text = await render(<Template locale={locale} data={data} />, {
    plainText: true,
  })

  return { html: html.replace(/react-email-/g, ''), text }
}
