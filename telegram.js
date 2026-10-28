// Manda as imagens da agenda do dia pro seu Telegram (o mesmo bot dos gols),
// com a legenda pronta pra postar no canal.
// Só funciona quando TELEGRAM_TOKEN e TELEGRAM_CHAT_ID existem (no GitHub, vêm dos segredos).
import { formatarData, ehHoje } from './mensagem.js';

export const telegramLigado = () => Boolean(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);

async function chamar(metodo, corpo) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/${metodo}`, { method: 'POST', body: corpo });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram (${metodo}): ${json.description}`);
  return json.result;
}

export function legendaAgenda(data, totalJogos, pagina) {
  const dia = formatarData(data);
  return [
    `📅 *Jogos ${ehHoje(data) ? 'de hoje' : 'do dia'}* · ${dia}`,
    `${totalJogos} jogos com horário e onde assistir ⚽🏀🏐🏈`,
    '',
    `👉 Salve os jogos na sua agenda: ${pagina}`,
  ].join('\n');
}

// imagens: lista de Buffers PNG. Vão juntas num álbum (até 10), com a legenda na primeira.
export async function enviarAgenda(imagens, data, totalJogos, pagina) {
  const chat = process.env.TELEGRAM_CHAT_ID;
  const legenda = legendaAgenda(data, totalJogos, pagina);
  if (!imagens.length) {
    return chamar('sendMessage', new URLSearchParams({ chat_id: chat, text: `${legenda}\n\n(nenhum jogo com transmissão hoje)` }));
  }
  for (let i = 0; i < imagens.length; i += 10) {
    const form = new FormData();
    form.append('chat_id', chat);
    const grupo = imagens.slice(i, i + 10);
    form.append('media', JSON.stringify(grupo.map((_, n) => ({
      type: 'photo',
      media: `attach://img${n}`,
      ...(i === 0 && n === 0 ? { caption: legenda } : {}),
    }))));
    grupo.forEach((img, n) => form.append(`img${n}`, new Blob([img], { type: 'image/png' }), `jogos-${data}-${i + n + 1}.png`));
    await chamar('sendMediaGroup', form);
  }
  // legenda também em texto solto, fácil de copiar pro WhatsApp
  await chamar('sendMessage', new URLSearchParams({ chat_id: chat, text: legenda, disable_web_page_preview: 'true' }));
}
