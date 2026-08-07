import { z } from 'zod'
import { renderEmailTemplate } from './renderEmailTemplate.js'
import type { Options } from '../types.js'
import { emailDataSchema } from '../validationSchemas/emailDataSchema.js'

export const sendEmailTemplateSchema = z.object({
  emailTemplate: z.string(),
  to: z.object({
    email: z.email().trim(),
    name: z.string().trim().optional().nullable(),
  }),
  subject: z.string(),
  locale: z.string(),
  data: z.looseObject({}).optional().nullable().default({}),
})

type Data = z.infer<typeof sendEmailTemplateSchema>

export const sendEmailTemplate = async ({
  options,
  data: providedData,
}: {
  options: Options
  data: Data
}) => {
  const { emailTemplate, locale, to, subject, data } =
    await sendEmailTemplateSchema.parseAsync(providedData)

  console.log(
    `[Mailferry] Sending email template "${emailTemplate}" to "${to.email}"`
  )

  const { html, text } = await renderEmailTemplate({
    options,
    template: emailTemplate,
    locale,
    data,
  })

  const emailData = await emailDataSchema.parseAsync({
    to: to.name ? `${to.name} <${to.email}>` : to.email,
    subject,
    html,
    text,
    from: options.from.name
      ? `${options.from.name} <${options.from.email}>`
      : options.from.email,
  })

  const response = await options.provider.sendEmail({
    data: emailData,
  })

  console.log(
    `[Mailferry] Email template "${emailTemplate}" sent to "${to.email}" successfully`
  )

  return {
    response,
    subject,
    text,
    html,
  }
}
