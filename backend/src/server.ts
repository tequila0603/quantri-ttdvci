import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()

try {
  const app = await buildApp({ config })
  await app.listen({ port: config.port, host: config.host })
} catch (error) {
  console.error('Failed to start API', error)
  process.exit(1)
}
