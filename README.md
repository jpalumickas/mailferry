# mailferry

Render and send localized React email templates in server runtimes that support the Fetch API. Mailferry provides a Hono-based HTTP handler, a client, Mailgun and Cloudflare Email Service providers, and an optional Cloudflare queue consumer.

## Install

```sh
npm install mailferry react react-dom
```

Node.js 20 or newer is required for Node-based builds. To use React Email's preview UI, also install `react-email` as a development dependency.

## Define and serve emails

Configure locales and translations in `emailConfig.ts`. Each template needs a translation entry with the same name:

```ts
import { createEmails } from 'mailferry/server'

export const emails = createEmails({
  availableLocales: ['en', 'lt'],
  translations: {
    welcome: {
      en: { subject: 'Welcome, {{name}}', title: 'Hello, {{name}}' },
      lt: { subject: 'Sveiki, {{name}}', title: 'Labas, {{name}}' },
    },
    common: {
      en: { footer: 'Thanks' },
      lt: { footer: 'Ačiū' },
    },
  },
})
```

Define `emails/WelcomeEmail.tsx`. `PreviewProps` supplies sample data for React Email's preview UI:

```tsx
import { emails } from '../emailConfig'

const WelcomeEmail = emails.template<{ name: string }>(
  'welcome',
  ({ t, data }) => (
    <div>
      <h1>{t('title', data)}</h1>
      <p>{t('common:footer')}</p>
    </div>
  )
)

WelcomeEmail.PreviewProps = { locale: 'lt', data: { name: 'Jonas' } }
export default WelcomeEmail
```

Register the template with the HTTP handler. Supply Mailgun credentials and the access token through your runtime's server-side configuration:

```ts
import { createMailgunProvider } from 'mailferry/providers/mailgun'
import { emails } from './emailConfig'
import WelcomeEmail from './emails/WelcomeEmail'

const TEMPLATES = [WelcomeEmail] as const

export const handler = emails.createHandler<{
  API_KEY: string
  API_HOST: string
  DOMAIN: string
  MAILFERRY_ACCESS_TOKEN: string
}>(({ env }) => ({
  templates: TEMPLATES,
  provider: createMailgunProvider({
    apiKey: env.API_KEY,
    apiHost: env.API_HOST,
    domain: env.DOMAIN,
  }),
  from: { email: 'hello@example.com' },
  accessToken: env.MAILFERRY_ACCESS_TOKEN,
}))
```

`handler.fetch` accepts a standard `Request` and returns a `Response`. Pass it to your runtime's Fetch API entry point or framework adapter. The `env` argument supplies the bindings used above. For example, in Node.js, install `@hono/node-server` and serve the handler with:

```ts
import { serve } from '@hono/node-server'
import { handler } from './handler'

serve({
  fetch: (request) =>
    handler.fetch(request, {
      API_KEY: process.env.API_KEY!,
      API_HOST: process.env.API_HOST!,
      DOMAIN: process.env.DOMAIN!,
      MAILFERRY_ACCESS_TOKEN: process.env.MAILFERRY_ACCESS_TOKEN!,
    }),
  port: 3000,
})
```

In a Cloudflare Worker, export the same handler so the runtime supplies its bindings:

```ts
import { handler } from './handler'

export default handler
```

For sends, an explicit `subject` takes precedence, followed by `createSubject` if configured, then the template's translated `subject`.

### Cloudflare Email Service provider

After onboarding your sending domain in Cloudflare Email Service, configure an Email Service send binding in `wrangler.jsonc`:

```jsonc
{
  "send_email": [{ "name": "EMAIL" }],
}
```

Use the binding as the provider and set the access token as a Worker secret:

```ts
import { createCloudflareBindingProvider } from 'mailferry/providers/cloudflare'
import { emails } from './emailConfig'
import WelcomeEmail from './emails/WelcomeEmail'

export default emails.createHandler<{
  EMAIL: SendEmail
  MAILFERRY_ACCESS_TOKEN: string
}>(({ env }) => ({
  templates: [WelcomeEmail],
  provider: createCloudflareBindingProvider(env.EMAIL),
  from: { email: 'hello@example.com', name: 'Example' },
  accessToken: env.MAILFERRY_ACCESS_TOKEN,
}))
```

`SendEmail` is provided by `@cloudflare/workers-types`. The provider returns Cloudflare's `{ messageId }` response and preserves its errors for HTTP and queue handling. See [Cloudflare's Workers API documentation](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/) for binding configuration and limits.

### Cloudflare REST API provider

You can also send with a Cloudflare API token and account ID, without a `send_email` binding. Give the token Email Sending: Edit permission and store it as a secret in your server runtime:

```ts
import { createCloudflareRestProvider } from 'mailferry/providers/cloudflare'
import { emails } from './emailConfig'
import WelcomeEmail from './emails/WelcomeEmail'

export default emails.createHandler<{
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_TOKEN: string
  MAILFERRY_ACCESS_TOKEN: string
}>(({ env }) => ({
  templates: [WelcomeEmail],
  provider: createCloudflareRestProvider({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  }),
  from: { email: 'hello@example.com', name: 'Example' },
  accessToken: env.MAILFERRY_ACCESS_TOKEN,
}))
```

The REST provider returns Cloudflare's delivery status (`delivered`, `queued`, and `permanent_bounces`) as the `response` value. API failures throw `CloudflareRestApiError` with `status` and `errors` fields. See [Cloudflare's REST API documentation](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).

### HTTP authentication

Set `accessToken` in the options returned by `emails.createHandler` to protect the HTTP endpoints. Read it from your runtime's secrets or environment configuration and keep it in trusted server code; do not include it in a browser bundle.

When `accessToken` is configured, both `POST /emails/:template/send` and `POST /emails/:template/render/:format` require an `Authorization: Bearer <token>` header. Missing or incorrect tokens receive `401 Unauthorized`. Without an access token, these HTTP endpoints are unauthenticated. Queue messages do not use this token.

### Queue messages

Cloudflare Workers can use `handler.queue` as a queue consumer. To send through a Cloudflare queue, enqueue a message with the template name, locale, recipient, and template data. This example assumes a producer binding named `EMAIL_QUEUE`:

```ts
await env.EMAIL_QUEUE.send({
  template: 'welcome',
  locale: 'en',
  to: { email: 'person@example.com' },
  data: { name: 'Person' },
})
```

The queue consumer uses the same template and subject rules as the HTTP handler. A `subject` field is optional when the template has a translated subject or `createSubject` is configured.

## Send and render from server code

```ts
import { createClient } from 'mailferry/client'

const mail = createClient({
  baseUrl: 'https://mail.example.com',
  accessToken: process.env.MAILFERRY_ACCESS_TOKEN,
})

await mail.send({
  template: 'welcome',
  locale: 'en',
  to: { email: 'person@example.com' },
  data: { name: 'Person' },
})

const html = await mail.render({
  template: 'welcome',
  locale: 'en',
  format: 'html',
  data: { name: 'Person' },
})
```

`send` returns the handler's JSON response. `render` returns HTML with `format: 'html'` or plain text with `format: 'txt'`. Failed HTTP responses throw `MailferryHttpError` with a `status` property. Keep the client and its access token in server code.

## License

MIT. See [LICENSE](LICENSE).
