import type { z } from 'zod'
import type { emailDataSchema } from './validationSchemas/emailDataSchema.js'

export type Options = {
  supportedLocales: string[]
  templates: EmailTemplates
  from: {
    email: string
    name?: string
  }
  onError?: (error: unknown) => void | Promise<void>
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
