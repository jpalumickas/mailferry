import { sendMailgunEmail } from './sendMailgunEmail'

type Args = {
  apiKey: string
  apiHost: string
  domain: string
}

export const createMailgunProvider = ({ apiKey, apiHost, domain }: Args) => {
  return {
    sendEmail: async (data: any) => {
      sendMailgunEmail({ apiKey, apiHost, domain, data })
    },
  }
}
