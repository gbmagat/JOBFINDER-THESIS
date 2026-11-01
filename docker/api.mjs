import { createApp } from '../server/app.js'
import { dockerRuntimeConfig } from './runtime-config.mjs'

const config = dockerRuntimeConfig()
const api = createApp(config)
const server = api.app.listen(config.port, config.host, () => {
  console.log('JobFinder container API ready on loopback')
})
const timer = api.notifications.enabled
  ? setInterval(() => {
    api.notifications.processBatch().catch((error) => console.error(error.message))
  }, 60_000)
  : null

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  if (timer) clearInterval(timer)
  server.close(async () => {
    try {
      await api.notifications.stop()
      api.close()
      process.exit(0)
    } catch (error) {
      console.error(error.message)
      process.exit(1)
    }
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
