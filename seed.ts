// seed.ts — rode com: npx tsx seed.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Inserindo dados de teste...')

  // Empresa
  const empresa = await prisma.empresa.upsert({
    where: { slug: 'barbearia-do-joao' },
    update: {},
    create: {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      nome: 'Barbearia do João',
      slug: 'barbearia-do-joao',
      telefone: '24999990001',
      plano: 'pro',
      ativo: true,
      endereco: { rua: 'Rua das Flores', numero: '42', cidade: 'Itatiaia', uf: 'RJ', cep: '27580-000' }
    }
  })
  console.log('✅ Empresa:', empresa.nome)

  // Barbeiro João (owner)
  const joao = await prisma.barbeiro.upsert({
    where: { email: 'joao@barbearia.com' },
    update: {},
    create: {
      nome: 'João Silva',
      email: 'joao@barbearia.com',
      senha_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBNl/IZ0NXHFT6', // senha123
      role: 'owner',
      ativo: true,
      empresa_id: empresa.id
    }
  })
  console.log('✅ Barbeiro:', joao.nome)

  // Barbeiro Carlos
  const carlos = await prisma.barbeiro.upsert({
    where: { email: 'carlos@barbearia.com' },
    update: {},
    create: {
      nome: 'Carlos Neto',
      email: 'carlos@barbearia.com',
      senha_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBNl/IZ0NXHFT6', // senha123
      role: 'barbeiro',
      ativo: true,
      empresa_id: empresa.id
    }
  })
  console.log('✅ Barbeiro:', carlos.nome)

  // Serviços
  const servicos = [
    { nome: 'Corte Degradê',      preco: 55, duracao_min: 45, ordem: 1 },
    { nome: 'Barba Completa',     preco: 40, duracao_min: 30, ordem: 2 },
    { nome: 'Corte + Barba',      preco: 85, duracao_min: 75, ordem: 3 },
    { nome: 'Hidratação Capilar', preco: 30, duracao_min: 20, ordem: 4 },
  ]
  for (const s of servicos) {
    await prisma.servico.create({
      data: { ...s, empresa_id: empresa.id, ativo: true }
    }).catch(() => {}) // ignora se já existir
  }
  console.log('✅ Serviços criados')

  // Grade de horários (João: Seg-Sex 09h-19h, Sáb 09h-14h)
  const dias = [
    { dia: 1, fim: '19:00' },
    { dia: 2, fim: '19:00' },
    { dia: 3, fim: '19:00' },
    { dia: 4, fim: '19:00' },
    { dia: 5, fim: '19:00' },
    { dia: 6, fim: '14:00' },
  ]
  for (const d of dias) {
    await prisma.horarioDisponivel.upsert({
      where: { empresa_id_barbeiro_id_dia_semana: {
        empresa_id: empresa.id, barbeiro_id: joao.id, dia_semana: d.dia
      }},
      update: {},
      create: {
        empresa_id: empresa.id,
        barbeiro_id: joao.id,
        dia_semana: d.dia,
        inicio: '09:00',
        fim: d.fim,
        intervalo_min: 30
      }
    })
  }
  console.log('✅ Grade de horários criada')

  // Cliente
  await prisma.cliente.upsert({
    where: { empresa_id_telefone: { empresa_id: empresa.id, telefone: '24999991111' } },
    update: {},
    create: {
      nome: 'Pedro Alves',
      telefone: '24999991111',
      empresa_id: empresa.id
    }
  })
  console.log('✅ Cliente criado')

  console.log('\n🎉 Seed concluído!')
  console.log('   Login: joao@barbearia.com')
  console.log('   Senha: senha123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
