import type { EmailData } from '../../types.js'
import { toMessage } from './message.js'
import type { CloudflareEmailMessage } from './message.js'

/** The structured send method of a Cloudflare Email Service binding. */
export type CloudflareEmailBinding = {
  send(message: CloudflareEmailMessage): Promise<{ messageId: string }>
}

/** Send rendered Mailferry emails through a Worker's `send_email` binding. */
export const createCloudflareBindingProvider = (
  binding: CloudflareEmailBinding
) => ({
  sendEmail: ({ data }: { data: EmailData }) => binding.send(toMessage(data)),
})
