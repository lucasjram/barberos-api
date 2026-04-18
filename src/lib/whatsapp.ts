// src/lib/whatsapp.ts — Evolution API
const EVO_URL      = process.env.EVOLUTION_URL!       // ex: https://xxx.ngrok-free.dev
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!  // ex: barbearia
const EVO_APIKEY   = process.env.EVOLUTION_APIKEY!    // ex: barberos2026

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const numero = telefone.replace(/\D/g, '')
  const numeroFormatado = numero.startsWith('55') ? numero : `55${numero}`
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_APIKEY,
      },
      body: JSON.stringify({ number: numeroFormatado, text: mensagem })
    })
    const data = await res.json()
    console.log(`✅ WhatsApp enviado para ${numeroFormatado}:`, JSON.stringify(data))
    return true
  } catch (e) {
    console.error(`❌ Erro WhatsApp:`, e)
    return false
  }
}

function formatarDataHora(iso: Date): string {
  return iso.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function notificarCliente(dados: {
  cliente_nome: string; cliente_telefone: string; barbeiro_nome: string
  servico_nome: string; empresa_nome: string; inicio_em: Date; preco: number
}) {
  if (!EVO_URL || !EVO_INSTANCE || !EVO_APIKEY) return
  const msg = [
    `✅ *Agendamento confirmado!*`, ``,
    `Olá, ${dados.cliente_nome.split(' ')[0]}! 👋`, ``,
    `📍 *${dados.empresa_nome}*`,
    `✂️ Serviço: ${dados.servico_nome}`,
    `👤 Barbeiro: ${dados.barbeiro_nome}`,
    `🕐 ${formatarDataHora(dados.inicio_em)}`,
    `💰 Valor: R$ ${dados.preco.toFixed(2)}`, ``,
    `Para cancelar, responda *CANCELAR* 🙏`,
  ].join('\n')
  await enviarWhatsApp(dados.cliente_telefone, msg)
}

export async function notificarBarbeiro(dados: {
  barbeiro_telefone: string; cliente_nome: string; cliente_telefone: string
  servico_nome: string; inicio_em: Date; preco: number
}) {
  if (!EVO_URL || !EVO_INSTANCE || !EVO_APIKEY) return
  const msg = [
    `💈 *Novo agendamento!*`, ``,
    `👤 Cliente: ${dados.cliente_nome}`,
    `📞 WhatsApp: ${dados.cliente_telefone}`,
    `✂️ Serviço: ${dados.servico_nome}`,
    `🕐 ${formatarDataHora(dados.inicio_em)}`,
    `💰 Valor: R$ ${dados.preco.toFixed(2)}`,
  ].join('\n')
  await enviarWhatsApp(dados.barbeiro_telefone, msg)
}
