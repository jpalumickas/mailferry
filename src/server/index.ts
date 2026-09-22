import { createApp } from './app.js'
import { createQueue } from './queue.js'
import type { CreateOptions } from '../types.js'

export const createHandler = <Env extends object>(
  createOptions: CreateOptions<Env>
) => {
  const { app } = createApp(createOptions)
  const queue = createQueue(createOptions)

  return {
    fetch: app.fetch,
    queue,
  }
}

export { renderEmailTemplate } from '../services/renderEmailTemplate.js'
