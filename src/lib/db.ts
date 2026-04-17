import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Client com filtro de empresa_id — isolamento via WHERE em vez de RLS
// Mais simples e compatível com Prisma + Supabase
export function db(empresa_id: string) {
  return {
    agendamento: {
      findMany:   (args: any = {}) => prisma.agendamento.findMany({ ...args, where: { ...args.where, empresa_id } }),
      findUnique: (args: any)      => prisma.agendamento.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      findFirst:  (args: any = {}) => prisma.agendamento.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      create:     (args: any)      => prisma.agendamento.create({ ...args, data: { ...args.data, empresa_id } }),
      update:     (args: any)      => prisma.agendamento.update({ ...args, where: { ...args.where } }),
      updateMany: (args: any = {}) => prisma.agendamento.updateMany({ ...args, where: { ...args.where, empresa_id } }),
      count:      (args: any = {}) => prisma.agendamento.count({ ...args, where: { ...args.where, empresa_id } }),
      aggregate:  (args: any = {}) => prisma.agendamento.aggregate({ ...args, where: { ...args.where, empresa_id } }),
    },
    barbeiro: {
      findMany:   (args: any = {}) => prisma.barbeiro.findMany({ ...args, where: { ...args.where, empresa_id } }),
      findUnique: (args: any)      => prisma.barbeiro.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      findFirst:  (args: any = {}) => prisma.barbeiro.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      create:     (args: any)      => prisma.barbeiro.create({ ...args, data: { ...args.data, empresa_id } }),
      update:     (args: any)      => prisma.barbeiro.update(args),
      updateMany: (args: any = {}) => prisma.barbeiro.updateMany({ ...args, where: { ...args.where, empresa_id } }),
    },
    cliente: {
      findMany:   (args: any = {}) => prisma.cliente.findMany({ ...args, where: { ...args.where, empresa_id } }),
      findUnique: (args: any)      => prisma.cliente.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      upsert:     (args: any)      => prisma.cliente.upsert(args),
    },
    servico: {
      findMany:   (args: any = {}) => prisma.servico.findMany({ ...args, where: { ...args.where, empresa_id } }),
      findUnique: (args: any)      => prisma.servico.findFirst({ ...args, where: { ...args.where, empresa_id } }),
      findFirst:  (args: any = {}) => prisma.servico.findFirst({ ...args, where: { ...args.where, empresa_id } }),
    },
    horarioDisponivel: {
      findMany:  (args: any = {}) => prisma.horarioDisponivel.findMany({ ...args, where: { ...args.where, empresa_id } }),
      findFirst: (args: any = {}) => prisma.horarioDisponivel.findFirst({ ...args, where: { ...args.where, empresa_id } }),
    },
    bloqueio: {
      findMany: (args: any = {}) => prisma.bloqueio.findMany({ ...args, where: { ...args.where, empresa_id } }),
    },
  }
}

// Client sem filtro — usado em rotas públicas (/public/:slug)
export const dbPublic = prisma
