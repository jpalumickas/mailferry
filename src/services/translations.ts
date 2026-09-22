import {
  createInstance,
  type Resource,
  type i18n as I18nInstance,
} from 'i18next'
import type { Options, Translations } from '../types.js'
import { MailServerValidationError } from '../errors.js'

type TranslationOptions = Pick<
  Options,
  'availableLocales' | 'supportedLocales' | 'translations'
>

export const getAvailableLocales = (options: TranslationOptions) =>
  options.availableLocales ?? options.supportedLocales ?? []

const toResources = (translations: Translations): Resource => {
  const resources: Resource = {}

  for (const [namespace, byLocale] of Object.entries(translations)) {
    for (const [locale, messages] of Object.entries(byLocale)) {
      resources[locale] ??= {}
      resources[locale][namespace] = messages
    }
  }

  return resources
}

export const requireTranslation = (
  translations: Translations,
  template: string,
  locale: string
) => {
  if (!translations[template]?.[locale]) {
    throw new MailServerValidationError(
      `Translations for template ${template} and locale ${locale} not found`
    )
  }
}

const instances = new WeakMap<Translations, I18nInstance>()

export const getTranslationInstance = (translations: Translations) => {
  let instance = instances.get(translations)
  if (!instance) {
    instance = createInstance()
    void instance.init({
      resources: toResources(translations),
      ns: Object.keys(translations),
      fallbackLng: false,
      initAsync: false,
      interpolation: { escapeValue: false },
    })
    instances.set(translations, instance)
  }
  return instance
}

export const createEmailI18n = async (
  translations: Translations,
  locale: string,
  template: string
): Promise<I18nInstance> => {
  requireTranslation(translations, template, locale)

  const instance = createInstance()
  await instance.init({
    resources: toResources(translations),
    lng: locale,
    ns: Object.keys(translations),
    defaultNS: template,
    fallbackLng: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  })
  return instance
}

export const resolveSubject = async ({
  options,
  subject,
  locale,
  template,
  data,
}: {
  options: Options
  subject?: string | null
  locale: string
  template: string
  data?: Record<string, unknown>
}) => {
  if (subject?.trim()) return subject.trim()

  if (options.createSubject) {
    return options.createSubject({ locale, template })
  }

  if (!options.translations) return undefined

  requireTranslation(options.translations, template, locale)
  const i18n = getTranslationInstance(options.translations)
  if (!i18n.exists('subject', { lng: locale, ns: template })) return undefined
  return i18n.getFixedT(locale, template)('subject', data)
}
