const { createServer } = require('http')
const next = require('next')

const PORT = 3000

function startServer() {
  const app = next({ dev: false, port: PORT })
  const handle = app.getRequestHandler()

  app.prepare().then(() => {
    const server = createServer((req, res) => {
      handle(req, res)
    })

    server.keepAliveTimeout = 5000
    server.headersTimeout = 10000

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`> KHOTLA AI ready on http://0.0.0.0:${PORT}`)
    })

    server.on('error', (err) => {
      console.error('Server error:', err)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      server.close(() => process.exit(0))
    })
    process.on('SIGINT', () => {
      server.close(() => process.exit(0))
    })

    // Keep process alive
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err)
    })
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled rejection:', err)
    })
  }).catch((err) => {
    console.error('Failed to start:', err)
    process.exit(1)
  })
}

startServer()
