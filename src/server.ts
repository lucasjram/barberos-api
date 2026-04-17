import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/auth'
import { publicRoutes } from './routes/public'
import { agendamentosRoutes } from './routes/agendamentos'
import { authMiddleware } from './middleware/auth'

const app = Fastify({ logger: true })

app.register(cors, { origin: '*' })

// Rotas públicas — cliente agendando, sem JWT
app.register(publicRoutes, { prefix: '/api/public' })

// Rotas de autenticação
app.register(authRoutes, { prefix: '/api/auth' })

// Rotas protegidas — barbeiro logado
app.register(async (instance) => {
  instance.addHook('onRequest', authMiddleware)
  instance.register(agendamentosRoutes, { prefix: '/api/agendamentos' })
})

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
    console.log(`\n🚀 BarberOS API rodando na porta ${process.env.PORT || 3000}\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
