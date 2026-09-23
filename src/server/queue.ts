import { MailServerValidationError } from '../errors.js'
import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import { resolveSubject } from '../services/translations.js'
import type { CreateOptions } from '../types.js'

type Data = {
  template: string
  locale: string
  to: {
    email: string
    name?: string
  }
  subject?: string | null
  data?: Record<string, unknown>
}

type QueueMessage<Body> = {
  body: Body
  ack(): void
  retry(): void
}

/** The queue methods Mailferry needs, compatible with Cloudflare queue batches. */
export type QueueBatch<Body> = {
  messages: Iterable<QueueMessage<Body>>
  retryAll(): void
}

export const createQueue =
  <Env extends object>(createOptions: CreateOptions<Env>) =>
  async (batch: QueueBatch<Data>, env: Env) => {
    const options = createOptions({ env })

    let messages: QueueMessage<Data>[]
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
        const subject = await resolveSubject({
          options,
          subject: message.body.subject,
          locale: message.body.locale,
          template: message.body.template,
          data: message.body.data || {},
        })

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
