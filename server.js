const { createServer } = require('http')
const next = require('next')

const PORT = 3000

function startServer() {
  const app = next({ dev: false, port: PORT })
  const handle = app.getRequestHandler()

  app.prepare().then(() => {
    const server = createServer((req, res) => {
      // Force Connection: close to prevent keep-alive issues
      res.setHeader('Connection', 'close')
      handle(req, res)
    })

    server.keepAliveTimeout = 1
    server.headersTimeout = 5000

    server.listen(PORT, () => {
      console.log(`> KHOTLA AI ready on http://localhost:${PORT}`)
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
  }).catch((err) => {
    console.error('Failed to start:', err)
    process.exit(1)
  })
}

startServer()
