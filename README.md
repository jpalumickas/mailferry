# mailferry

## HTTP authentication

Optionally set `accessToken` in the options returned by `createHandler`'s options factory. In a Cloudflare Worker, read it from a secret binding (for example, `accessToken: env.MAIL_SERVER_ACCESS_TOKEN`) rather than hard-coding it.

When `accessToken` is configured, both `/emails/:template/send` and `/emails/:template/render/:format` require an `Authorization: Bearer <token>` header. Missing or incorrect tokens receive `401 Unauthorized`. If `accessToken` is not configured, these HTTP endpoints are unauthenticated; avoid exposing them publicly in that configuration. Queue messages do not use this token.
