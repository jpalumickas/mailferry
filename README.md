# mailferry

Render and send React email templates through an HTTP handler or a Cloudflare queue consumer.

## Server implementation

Configure locales and translations in `emailConfig.ts`:

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

Define `emails/WelcomeEmail.tsx` for both sending and React Email previews:

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

Register the template in your worker:

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

The template's translation entry supplies the subject when a send omits it. An explicit subject takes precedence. `createSubject`, when configured, takes precedence over the translated subject. The existing `createHandler` map API and `supportedLocales` remain available.

### HTTP authentication

Optionally set `accessToken` in the options returned by `emails.createHandler`. In a Cloudflare Worker, read it from a secret binding (for example, `accessToken: env.MAILFERRY_ACCESS_TOKEN`). Keep this token in trusted server code; do not include it in a browser bundle.

When `accessToken` is configured, both `/emails/:template/send` and `/emails/:template/render/:format` require an `Authorization: Bearer <token>` header. Missing or incorrect tokens receive `401 Unauthorized`. Without an access token, these HTTP endpoints are unauthenticated. Queue messages do not use this token.

## Client implementation

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

`send` returns the handler's JSON response. `render` returns the rendered HTML or plain text. Failed HTTP responses throw `MailferryHttpError` with a `status` property.

## Publishing to npm

From a fresh checkout, install dependencies and sign in to the public npm registry:

```sh
pnpm install --frozen-lockfile
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish
```

The `prepack` script builds the `dist` files before publication. Publishing requires npm two-factor authentication or a granular access token that can bypass it. The `mailferry` name is unscoped, so `--access public` is unnecessary.

## License

MIT. See [LICENSE](LICENSE).
