export class MailServerError extends Error {}

export class MailServerValidationError extends MailServerError {}
export class MailServerProviderError extends MailServerError {}
