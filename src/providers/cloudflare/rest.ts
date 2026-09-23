import { MailServerProviderError } from '../../errors.js'
import type { EmailData } from '../../types.js'
import { toMessage } from './message.js'

export type CloudflareRestSendResult = {
  delivered: string[]
  permanent_bounces: string[]
  queued: string[]
  message_id?: string
  suppressed_recipients?: string[]
}

export type CloudflareRestApiErrorDetail = {
  code: number
  message: string
}

export class CloudflareRestApiError extends MailServerProviderError {
  readonly status: number
  readonly errors: CloudflareRestApiErrorDetail[]

  constructor(status: number, errors: CloudflareRestApiErrorDetail[] = []) {
    super(
      `Cloudflare Email Service send failed. Status: ${status}${errors[0] ? ` (${errors[0].code}: ${errors[0].message})` : ''}`
    )
    this.name = 'CloudflareRestApiError'
    this.status = status
    this.errors = errors
  }
}

type CloudflareRestResponse = {
  success: boolean
  errors: CloudflareRestApiErrorDetail[]
  result: CloudflareRestSendResult | null
}

/** Send rendered Mailferry emails through Cloudflare's token-authenticated REST API. */
export const createCloudflareRestProvider = ({
  accountId,
  apiToken,
}: {
  accountId: string
  apiToken: string
}) => ({
  sendEmail: async ({ data }: { data: EmailData }) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toMessage(data)),
      }
    )

    let body: CloudflareRestResponse | null = null
    try {
      body = (await response.json()) as CloudflareRestResponse
    } catch {
      throw new CloudflareRestApiError(response.status)
    }

    if (!response.ok || body?.success !== true || !body.result) {
      throw new CloudflareRestApiError(
        response.status,
        Array.isArray(body?.errors) ? body.errors : []
      )
    }

    return body.result
  },
})
