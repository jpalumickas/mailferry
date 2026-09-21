# mailferry

## HTTP authentication

Set `accessToken` in the options returned by `createHandler`'s options factory. In a Cloudflare Worker, read it from a secret binding (for example, `accessToken: env.MAIL_SERVER_ACCESS_TOKEN`) rather than hard-coding it.

Both `/emails/:template/send` and `/emails/:template/render/:format` require an `Authorization: Bearer <token>` header. HTTP requests receive `401 Unauthorized` when the token is missing, incorrect, or not configured. Queue messages do not use this token.
