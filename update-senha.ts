import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const hash = '$2a$12$WRT3zz1mClEnqHoZc0VHmuw.6dFzcCk5BCD3sppToyXZoBcm0rgMK'

  const result = await prisma.barbeiro.updateMany({
    where: { email: 'joao@barbearia.com' },
    data:  { senha_hash: hash }
  })

  console.log('✅ Senha atualizada! Registros:', result.count)
  await prisma.$disconnect()
}

main().catch(console.error)
