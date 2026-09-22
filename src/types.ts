import type { z } from 'zod'
import type { i18n } from 'i18next'
import type { emailDataSchema } from './validationSchemas/emailDataSchema.js'

export type Translations = Record<
  string,
  Record<string, Record<string, unknown>>
>

export type EmailI18n = Pick<i18n, 't' | 'language'>

export type TranslatedEmailTemplateProps<Data = unknown> = {
  locale: string
  data: Data
  i18n: EmailI18n
}

type LocaleOptions =
  | { availableLocales: string[]; supportedLocales?: string[] }
  | {
      availableLocales?: string[]
      /** @deprecated Use availableLocales instead. */
      supportedLocales: string[]
    }

export type Options = LocaleOptions & {
  translations?: Translations
  templates: EmailTemplates
  from: {
    email: string
    name?: string
  }
  onError?: (error: unknown) => void | Promise<void>
  /** When set, HTTP requests require a matching bearer token; queues do not. */
  accessToken?: string
  provider: Provider
  createSubject?: (options: {
    locale: string
    template: string
  }) => Promise<string>
}

export type CreateOptions<Env extends object> = ({
  env,
}: {
  env: Env
}) => Options

export type EmailTemplates = Record<string, React.ComponentType<any>>

export type EmailData = z.infer<typeof emailDataSchema>

export type Provider = {
  sendEmail: (options: { data: EmailData }) => Promise<unknown>
}
