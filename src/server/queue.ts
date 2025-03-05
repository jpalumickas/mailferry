import { sendEmailTemplate } from '../services/sendEmailTemplate.js'
import type { CreateOptions, Options } from '../types.js'

type Data = {
  template: string
  locale: string
  to: {
    email: string
    name: string
  }
  data?: Record<string, string | number>
}

export const createQueue =
  <Env extends object>(createOptions: CreateOptions<Env>) =>
  async (batch: MessageBatch<Data>, env: Env) => {
    const options = createOptions({ env })

    try {
      for (const message of batch.messages) {
        try {
          const result = await sendEmailTemplate({
            options,
            data: {
              emailTemplate: message.body.template,
              locale: message.body.locale,
              to: message.body.to,
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
