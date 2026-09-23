# mailferry

Render and send localized React email templates from a Cloudflare Worker. Mailferry provides an HTTP handler, a queue consumer, a client, and a Mailgun provider.

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

Register the template in your Cloudflare Worker. Set the Mailgun credentials and access token as Worker secrets or environment bindings:

```ts
import { createMailgunProvider } from 'mailferry/providers/mailgun'
import { emails } from './emailConfig'
import WelcomeEmail from './emails/WelcomeEmail'

const TEMPLATES = [WelcomeEmail] as const

export default emails.createHandler<{
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

The exported handler serves HTTP requests and consumes Cloudflare queue messages. For sends, an explicit `subject` takes precedence, followed by `createSubject` if configured, then the template's translated `subject`.

### HTTP authentication

Set `accessToken` in the options returned by `emails.createHandler` to protect the HTTP endpoints. Read it from a Worker secret binding and keep it in trusted server code; do not include it in a browser bundle.

When `accessToken` is configured, both `POST /emails/:template/send` and `POST /emails/:template/render/:format` require an `Authorization: Bearer <token>` header. Missing or incorrect tokens receive `401 Unauthorized`. Without an access token, these HTTP endpoints are unauthenticated. Queue messages do not use this token.

### Queue messages

To send through a Cloudflare queue, enqueue a message with the template name, locale, recipient, and template data. This example assumes a producer binding named `EMAIL_QUEUE`:

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
