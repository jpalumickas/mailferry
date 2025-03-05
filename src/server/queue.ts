import { MailServerValidationError } from '../errors.js'
import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import type { CreateOptions } from '../types.js'

type Data = {
  template: string
  locale: string
  to: {
    email: string
    name: string
  }
  subject: string | undefined | null
  data?: Record<string, string | number>
}

export const createQueue =
  <Env extends object>(createOptions: CreateOptions<Env>) =>
  async (batch: MessageBatch<Data>, env: Env) => {
    const options = createOptions({ env })

    try {
      for (const message of batch.messages) {
        try {
          const subject =
            message.body.subject ||
            options.createSubject?.({
              locale: message.body.locale,
              template: message.body.template,
            })

          if (!subject?.trim()) {
            throw new MailServerValidationError('Subject is required')
          }

          const result = await sendEmailTemplate({
            options,
            data: {
              emailTemplate: message.body.template,
              locale: message.body.locale,
              to: message.body.to,
              subject,
              data: message.body.data || {},
            },
          })
        } catch (error) {
          if (options.onError) {
            options.onError(error)
          } else {
            throw error
          }
        }
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error)
      } else {
        throw error
      }
    }
  }
