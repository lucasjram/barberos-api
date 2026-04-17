import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../lib/db'

export async function agendamentosRoutes(app: FastifyInstance) {

  // GET /api/agendamentos?date=YYYY-MM-DD
  // Agenda do barbeiro logado no dia
  app.get('/', async (req) => {
    const user = (req as any).user
    const { date } = req.query as any
    const client = db(user.empresa_id)

    const inicio = date
      ? new Date(date + 'T00:00:00-03:00')
      : new Date(new Date().setHours(0, 0, 0, 0))
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)

    const agendamentos = await client.agendamento.findMany({
      where: {
        barbeiro_id: user.role === 'owner' ? undefined : user.barbeiro_id,
        inicio_em: { gte: inicio, lt: fim },
        status: { not: 'cancelado' }
      },
      include: {
        cliente:  { select: { nome: true, telefone: true } },
        servico:  { select: { nome: true, duracao_min: true } },
        barbeiro: { select: { nome: true } },
      },
      orderBy: { inicio_em: 'asc' }
    })

    return agendamentos
  })

  // GET /api/agendamentos/:id
  app.get('/:id', async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const client = db(user.empresa_id)

    const ag = await client.agendamento.findUnique({
      where: { id },
      include: {
        cliente:  true,
        servico:  true,
        barbeiro: { select: { nome: true, foto_url: true } },
      }
    })
    if (!ag) return reply.status(404).send({ error: 'Agendamento não encontrado' })
    return ag
  })

  // PUT /api/agendamentos/:id/status
  // Barbeiro atualiza status: confirmado | concluido | cancelado | faltou
  app.put('/:id/status', async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const client = db(user.empresa_id)

    const schema = z.object({
      status: z.enum(['confirmado', 'concluido', 'cancelado', 'faltou']),
      motivo_cancel: z.string().optional(),
    })
    const { status, motivo_cancel } = schema.parse(req.body)

    const ag = await client.agendamento.update({
      where: { id },
      data: {
        status,
        cancelado_por: status === 'cancelado' ? 'barbeiro' : undefined,
        cancelado_em:  status === 'cancelado' ? new Date() : undefined,
        motivo_cancel: status === 'cancelado' ? motivo_cancel : undefined,
      }
    })

    return ag
  })

  // GET /api/agendamentos/stats/hoje
  // Dashboard — contadores do dia
  app.get('/stats/hoje', async (req) => {
    const user = (req as any).user
    const client = db(user.empresa_id)
    const hoje = new Date()
    const inicio = new Date(hoje.setHours(0, 0, 0, 0))
    const fim    = new Date(hoje.setHours(23, 59, 59, 999))

    const [total, concluidos, pendentes, faturamento] = await Promise.all([
      client.agendamento.count({
        where: { inicio_em: { gte: inicio, lte: fim }, status: { not: 'cancelado' } }
      }),
      client.agendamento.count({
        where: { inicio_em: { gte: inicio, lte: fim }, status: 'concluido' }
      }),
      client.agendamento.count({
        where: { inicio_em: { gte: inicio, lte: fim }, status: { in: ['agendado', 'confirmado'] } }
      }),
      client.agendamento.aggregate({
        where: { inicio_em: { gte: inicio, lte: fim }, status: 'concluido' },
        _sum: { preco_cobrado: true }
      }),
    ])

    return {
      total,
      concluidos,
      pendentes,
      faturamento: Number(faturamento._sum.preco_cobrado || 0),
    }
  })
}
