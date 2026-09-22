export type Recipient = {
  email: string
  name?: string
}

export type TemplateData = object

export type SendEmailInput = {
  template: string
  locale: string
  to: Recipient
  subject?: string
  data?: TemplateData
}

export type SendEmailResult = {
  success: true
  response?: unknown
  subject: string
  text: string
  html: string
}

export type RenderEmailInput = {
  template: string
  locale: string
  format: 'html' | 'txt'
  data?: TemplateData
}

export type ClientOptions = {
  baseUrl: string
  accessToken?: string
  fetch?: typeof fetch
}

export class MailferryHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MailferryHttpError'
    this.status = status
  }
}

export const createClient = ({
  baseUrl,
  accessToken,
  fetch: fetchImpl = globalThis.fetch,
}: ClientOptions) => {
  const root = baseUrl.replace(/\/+$/, '')

  const post = async (path: string, body: object) => {
    const response = await fetchImpl(`${root}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new MailferryHttpError(
        response.status,
        detail || `Mailferry request failed (${response.status})`
      )
    }

    return response
  }

  return {
    send: async ({ template, ...body }: SendEmailInput) => {
      const response = await post(
        `/emails/${encodeURIComponent(template)}/send`,
        body
      )
      return (await response.json()) as SendEmailResult
    },
    render: async ({ template, format, ...body }: RenderEmailInput) => {
      const response = await post(
        `/emails/${encodeURIComponent(template)}/render/${format}`,
        body
      )
      return response.text()
    },
  }
}
