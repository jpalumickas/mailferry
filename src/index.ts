import { createApp } from './server/app.js'
import { createQueue } from './server/queue.js'
import { Options } from './types.js'

export const createHandler = (options: Options) => {
  const { app } = createApp(options)
  const queue = createQueue(options)

  return {
    fetch: app.fetch,
    queue,
  }
}
