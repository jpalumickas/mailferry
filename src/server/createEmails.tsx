import type React from 'react'
import type { TFunction } from 'i18next'
import { MailServerValidationError } from '../errors.js'
import {
  getTranslationInstance,
  requireTranslation,
} from '../services/translations.js'
import type { Options, Translations } from '../types.js'
import { createHandler } from './index.js'

export type TemplateProps<Data> = { locale: string; data: Data }
export type TemplateRenderProps<Data> = TemplateProps<Data> & { t: TFunction }
export type NamedEmailTemplate = React.ComponentType<any> & {
  templateName: string
}
export type PreviewEmailTemplate<Data> = React.ComponentType<
  TemplateProps<Data>
> & {
  templateName: string
  PreviewProps?: TemplateProps<Data>
}

type FactoryOptions = {
  availableLocales: readonly string[]
  translations: Translations
}

type HandlerOptions = Omit<
  Options,
  'templates' | 'availableLocales' | 'supportedLocales' | 'translations'
> & { templates: readonly NamedEmailTemplate[] }

export const createEmails = ({
  availableLocales,
  translations,
}: FactoryOptions) => {
  const i18n = getTranslationInstance(translations)

  const template = <Data,>(
    name: string,
    render: (props: TemplateRenderProps<Data>) => React.ReactNode
  ): PreviewEmailTemplate<Data> => {
    if (!name) throw new MailServerValidationError('Template name is required')

    const Component = ({ locale, data }: TemplateProps<Data>) => {
      if (!availableLocales.includes(locale)) {
        throw new MailServerValidationError(`Locale ${locale} not supported`)
      }
      requireTranslation(translations, name, locale)
      return render({ locale, data, t: i18n.getFixedT(locale, name) })
    }

    return Object.assign(Component, {
      templateName: name,
    }) as PreviewEmailTemplate<Data>
  }

  const createEmailsHandler = <Env extends object>(
    createOptions: (args: { env: Env }) => HandlerOptions
  ) =>
    createHandler<Env>((args) => {
      const { templates, ...options } = createOptions(args)
      const byName: Options['templates'] = Object.create(null)

      for (const component of templates) {
        const name = component.templateName
        if (!name || Object.hasOwn(byName, name)) {
          throw new MailServerValidationError(
            `Template name ${name || '(empty)'} is missing or duplicated`
          )
        }
        byName[name] = component
      }

      return {
        ...options,
        templates: byName,
        availableLocales: [...availableLocales],
        translations,
      }
    })

  return { template, createHandler: createEmailsHandler }
}
