import React from 'react'
import { render } from '@react-email/render'
import type { Options } from '../types.js'

type Props = {
  options: Options
  template: string
  locale: string
  subject: string
  data: any
}

export const renderEmailTemplate = async ({
  options,
  template,
  locale,
  subject,
  data,
}: Props) => {
  const Template = options.templates[template]

  if (!Template) {
    throw new Error(`Template ${template} not found`)
  }

  if (!options.supportedLocales.includes(locale)) {
    throw new Error(`Locale ${locale} not supported`)
  }

  const html = await render(<Template locale={locale} data={data} />, {
    pretty: true,
  })

  const text = await render(<Template locale={locale} data={data} />, {
    plainText: true,
  })

  return { html: html.replace(/react\-email\-/g, ''), text, subject }
}
