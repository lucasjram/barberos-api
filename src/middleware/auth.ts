import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token obrigatório' })
  }
  const token = auth.replace('Bearer ', '')
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
    ;(req as any).user = payload
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
}
