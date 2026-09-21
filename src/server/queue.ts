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

    let messages: (typeof batch.messages)[number][]
    try {
      messages = Array.from(batch.messages)
    } catch (error) {
      if (options.onError) {
        batch.retryAll()
        await options.onError(error)
        return
      }
      throw error
    }

    for (const message of messages) {
      try {
        const subject =
          message.body.subject?.trim() ||
          (options.createSubject
            ? await options.createSubject({
                locale: message.body.locale,
                template: message.body.template,
              })
            : undefined)

        if (!subject?.trim()) {
          throw new MailServerValidationError('Subject is required')
        }

        await sendEmailTemplate({
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
        if (!options.onError) {
          throw error
        }
        message.retry()
        await options.onError(error)
        continue
      }

      message.ack()
    }
  }
