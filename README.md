# mailferry

Render and send React email templates through an HTTP handler or a Cloudflare queue consumer.

## Imports

```ts
import { createClient } from 'mailferry/client'
import { createHandler } from 'mailferry/server'
import { createMailgunProvider } from 'mailferry/providers/mailgun'
```

The client calls the handler's send and render endpoints:

```ts
const mail = createClient({
  baseUrl: 'https://mail.example.com',
  accessToken: process.env.MAILFERRY_ACCESS_TOKEN,
})

await mail.send({
  template: 'welcome',
  locale: 'en',
  to: { email: 'person@example.com' },
  subject: 'Welcome',
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

## HTTP authentication

Optionally set `accessToken` in the options returned by `createHandler`'s options factory. In a Cloudflare Worker, read it from a secret binding (for example, `accessToken: env.MAILFERRY_ACCESS_TOKEN`) rather than hard-coding it. Keep this token in trusted server code; do not include it in a browser bundle.

When `accessToken` is configured, both `/emails/:template/send` and `/emails/:template/render/:format` require an `Authorization: Bearer <token>` header. Missing or incorrect tokens receive `401 Unauthorized`. If `accessToken` is not configured, these HTTP endpoints are unauthenticated; avoid exposing them publicly in that configuration. Queue messages do not use this token.

## Publishing to npm

From a fresh checkout, install dependencies and sign in to the public npm registry:

```sh
pnpm install --frozen-lockfile
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish
```

The `prepack` script builds the `dist` files before publication. Publishing requires npm two-factor authentication or a granular access token that can bypass it. The `mailferry` name is unscoped, so `--access public` is unnecessary.
