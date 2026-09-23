import type { EmailData } from '../../types.js'

type EmailAddress = string | { email: string; name: string }

export type CloudflareEmailMessage = {
  from: EmailAddress
  to: EmailAddress
  subject: string
  html: string
  text?: string
  cc?: EmailAddress
  bcc?: EmailAddress
}

const toAddress = (value: string): EmailAddress => {
  const match = /^(.*) <([^<>]+)>$/.exec(value)
  return match ? { name: match[1]!, email: match[2]! } : value
}

export const toMessage = (data: EmailData): CloudflareEmailMessage => ({
  from: toAddress(data.from),
  to: toAddress(data.to),
  subject: data.subject,
  html: data.html,
  ...(data.text !== undefined && { text: data.text }),
  ...(data.cc !== undefined && { cc: toAddress(data.cc) }),
  ...(data.bcc !== undefined && { bcc: toAddress(data.bcc) }),
})
