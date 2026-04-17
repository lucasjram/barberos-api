import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { dbPublic, prisma } from '../lib/db'
import { notificarCliente, notificarBarbeiro } from '../lib/whatsapp'

export async function publicRoutes(app: FastifyInstance) {

  // GET /api/public/:slug — dados da barbearia (barbeiros + serviços)
  app.get('/:slug', async (req, reply) => {
    const { slug } = req.params as any

    const empresa = await dbPublic.empresa.findUnique({
      where: { slug, ativo: true },
      select: {
        id: true, nome: true, logo_url: true, telefone: true, endereco: true,
        barbeiros: {
          where: { ativo: true },
          select: { id: true, nome: true, foto_url: true }
        },
        servicos: {
          where: { ativo: true },
          orderBy: { ordem: 'asc' },
          select: { id: true, nome: true, descricao: true, preco: true, duracao_min: true }
        }
      }
    })

    if (!empresa) return reply.status(404).send({ error: 'Barbearia não encontrada' })
    return empresa
  })

  // GET /api/public/:slug/slots?barbeiro_id=&servico_id=&date=YYYY-MM-DD
  app.get('/:slug/slots', async (req, reply) => {
    const { slug } = req.params as any
    const { barbeiro_id, servico_id, date } = req.query as any

    if (!barbeiro_id || !servico_id || !date) {
      return reply.status(400).send({ error: 'barbeiro_id, servico_id e date são obrigatórios' })
    }

    const empresa = await dbPublic.empresa.findUnique({ where: { slug, ativo: true } })
    if (!empresa) return reply.status(404).send({ error: 'Barbearia não encontrada' })

    const servico = await prisma.servico.findFirst({
      where: { id: servico_id, empresa_id: empresa.id }
    })
    if (!servico) return reply.status(404).send({ error: 'Serviço não encontrado' })

    const dayOfWeek = new Date(date + 'T12:00:00').getDay()
    const grade = await prisma.horarioDisponivel.findFirst({
      where: { empresa_id: empresa.id, barbeiro_id, dia_semana: dayOfWeek }
    })
    if (!grade) return { slots: [] }

    const inicioDia = new Date(date + 'T00:00:00-03:00')
    const fimDia    = new Date(date + 'T23:59:59-03:00')

    const ocupados = await prisma.agendamento.findMany({
      where: {
        empresa_id: empresa.id,
        barbeiro_id,
        inicio_em: { gte: inicioDia, lte: fimDia },
        status: { in: ['agendado', 'confirmado'] }
      },
      select: { inicio_em: true, fim_em: true }
    })

    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        empresa_id: empresa.id,
        barbeiro_id,
        inicio_em: { lte: fimDia },
        fim_em:    { gte: inicioDia }
      },
      select: { inicio_em: true, fim_em: true }
    })

    const slots = gerarSlots(grade, Number(servico.duracao_min), [...ocupados, ...bloqueios], date)
    return { slots }
  })

  // POST /api/public/:slug/agendamentos — cliente confirma agendamento
  app.post('/:slug/agendamentos', async (req, reply) => {
    const { slug } = req.params as any

    const schema = z.object({
      barbeiro_id:      z.string().uuid(),
      servico_id:       z.string().uuid(),
      inicio_em:        z.string(),
      cliente_nome:     z.string().min(2),
      cliente_telefone: z.string().min(10),
      observacoes:      z.string().optional(),
    })

    const body = schema.parse(req.body)

    const empresa = await dbPublic.empresa.findUnique({ where: { slug, ativo: true } })
    if (!empresa) return reply.status(404).send({ error: 'Barbearia não encontrada' })

    const servico = await prisma.servico.findFirst({
      where: { id: body.servico_id, empresa_id: empresa.id, ativo: true }
    })
    if (!servico) return reply.status(404).send({ error: 'Serviço não encontrado' })

    const inicio = new Date(body.inicio_em)
    const fim    = new Date(inicio.getTime() + Number(servico.duracao_min) * 60000)

    // Verifica conflito de horário
    const conflito = await prisma.agendamento.findFirst({
      where: {
        empresa_id:  empresa.id,
        barbeiro_id: body.barbeiro_id,
        status:      { in: ['agendado', 'confirmado'] },
        inicio_em:   { lt: fim },
        fim_em:      { gt: inicio },
      }
    })
    if (conflito) return reply.status(409).send({ error: 'Horário não disponível' })

    // Upsert do cliente
    const cliente = await prisma.cliente.upsert({
      where: {
        empresa_id_telefone: {
          empresa_id: empresa.id,
          telefone:   body.cliente_telefone
        }
      },
      update: { nome: body.cliente_nome },
      create: { empresa_id: empresa.id, nome: body.cliente_nome, telefone: body.cliente_telefone }
    })

    // Cria agendamento
    const agendamento = await prisma.agendamento.create({
      data: {
        empresa_id:    empresa.id,
        barbeiro_id:   body.barbeiro_id,
        cliente_id:    cliente.id,
        servico_id:    body.servico_id,
        inicio_em:     inicio,
        fim_em:        fim,
        preco_cobrado: servico.preco,
        status:        'agendado',
        observacoes:   body.observacoes,
      }
    })

    // Busca dados do barbeiro para notificação
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: body.barbeiro_id },
      select: { nome: true, telefone: true }
    })

    // Dispara notificações em background (não bloqueia resposta)
    setImmediate(async () => {
      try {
        // Notifica o cliente
        await notificarCliente({
          cliente_nome:     body.cliente_nome,
          cliente_telefone: body.cliente_telefone,
          barbeiro_nome:    barbeiro?.nome || 'Barbeiro',
          servico_nome:     servico.nome,
          empresa_nome:     empresa.nome,
          inicio_em:        inicio,
          preco:            Number(servico.preco),
        })

        // Notifica o barbeiro (se tiver telefone cadastrado)
        if (barbeiro?.telefone) {
          await notificarBarbeiro({
            barbeiro_telefone: barbeiro.telefone,
            cliente_nome:      body.cliente_nome,
            cliente_telefone:  body.cliente_telefone,
            servico_nome:      servico.nome,
            inicio_em:         inicio,
            preco:             Number(servico.preco),
          })
        }
      } catch (e) {
        console.error('Erro nas notificações WhatsApp:', e)
      }
    })

    return reply.status(201).send({
      agendamento_id: agendamento.id,
      status:         agendamento.status,
      inicio_em:      agendamento.inicio_em,
      fim_em:         agendamento.fim_em,
      preco_cobrado:  agendamento.preco_cobrado,
    })
  })
}

// Gera slots livres no intervalo da grade de trabalho
function gerarSlots(
  grade: { inicio: string; fim: string; intervalo_min: number },
  duracaoMin: number,
  ocupados: { inicio_em: Date; fim_em: Date }[],
  date: string
) {
  const slots = []
  const [hI, mI] = grade.inicio.split(':').map(Number)
  const [hF, mF] = grade.fim.split(':').map(Number)

  let cursor = new Date(`${date}T${grade.inicio}:00-03:00`)
  const fimGrade = new Date(`${date}T${grade.fim}:00-03:00`)

  while (cursor.getTime() + duracaoMin * 60000 <= fimGrade.getTime()) {
    const slotFim = new Date(cursor.getTime() + duracaoMin * 60000)
    const livre   = !ocupados.some(o => cursor < o.fim_em && slotFim > o.inicio_em)

    slots.push({
      horario:    cursor.toISOString(),
      disponivel: livre,
      label:      cursor.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    })

    cursor = new Date(cursor.getTime() + grade.intervalo_min * 60000)
  }

  return slots
}
