import { EmailData } from '@/types'

function urlEncodeObject(obj: { [s: string]: any }) {
  return Object.keys(obj)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&')
}

export const sendMailgunEmail = async ({
  apiKey,
  apiHost,
  domain,
  data,
}: {
  apiKey: string
  apiHost: string
  domain: string
  data: EmailData
}) => {
  const dataUrlEncoded = urlEncodeObject(data)
  const opts = {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa('api:' + apiKey),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': dataUrlEncoded.length.toString(),
    },
    body: dataUrlEncoded,
  }

  console.log(`Sending email to ${data.to}`)

  const response = await fetch(`https://${apiHost}/v3/${domain}/messages`, opts)

  if (!response.ok) {
    throw new Error(`Send email failed. Status: ${response.status}`)
  }

  console.log(`Email sent to ${data.to} successfully`)

  const result = await response.json()
  return result
}
