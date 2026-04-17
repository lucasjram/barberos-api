import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/db'

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      senha: z.string().min(6),
    })
    const { email, senha } = schema.parse(req.body)

    const barbeiro = await prisma.barbeiro.findUnique({
      where: { email },
      include: { empresa: { select: { id: true, nome: true, slug: true, ativo: true } } }
    })

    if (!barbeiro || !barbeiro.ativo) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }
    if (!barbeiro.empresa.ativo) {
      return reply.status(403).send({ error: 'Conta da barbearia inativa' })
    }

    const senhaOk = await bcrypt.compare(senha, barbeiro.senha_hash)
    if (!senhaOk) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      { barbeiro_id: barbeiro.id, empresa_id: barbeiro.empresa_id, role: barbeiro.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token,
      barbeiro: {
        id: barbeiro.id,
        nome: barbeiro.nome,
        email: barbeiro.email,
        role: barbeiro.role,
        foto_url: barbeiro.foto_url,
      },
      empresa: barbeiro.empresa,
    }
  })

  // GET /api/auth/me
  app.get('/me', {
    preHandler: async (req, reply) => {
      const auth = req.headers.authorization
      if (!auth) return reply.status(401).send({ error: 'Não autenticado' })
      try {
        const payload = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET!) as any
        ;(req as any).user = payload
      } catch {
        return reply.status(401).send({ error: 'Token inválido' })
      }
    }
  }, async (req) => {
    const user = (req as any).user
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: user.barbeiro_id },
      select: { id: true, nome: true, email: true, role: true, foto_url: true,
                empresa: { select: { id: true, nome: true, slug: true } } }
    })
    return barbeiro
  })
}
