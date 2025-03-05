import { z } from 'zod'

export const emailDataSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
})
