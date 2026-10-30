// Jogos com transmissão do oGol (feed RSS "zapping"). Cobre umas 30 h à frente, traz uma emissora
// por jogo e não diz o campeonato. Serve de reforço do futnatv: completa emissoras e jogos que
// faltam lá, e segura a agenda de futebol se o futnatv cair.
// Ex.: "Konyaspor x Galatasaray - 30/10 17:00 - ESPN4" (horário de Lisboa)
export const FEED = 'https://www.ogol.com.br/rss/zapping';
const CABECALHO = { 'User-Agent': 'agenda-esportiva-bot/1.0 (+https://github.com/o-bom-redator/agenda-esportiva)' };

const desfazer = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Hora de Lisboa → Date (acha o fuso de Lisboa naquele dia: +0 no inverno, +1 no verão)
function deLisboa(ano, mes, dia, hora, minuto) {
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const lisboa = new Date(new Date(comoUtc).toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
  const utc = new Date(new Date(comoUtc).toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(comoUtc - (lisboa - utc));
}

// "São Paulo (Feminino S20)" → "São Paulo Feminino Sub-20"; "(Futsal)" vira o campeonato
function limparTime(nome) {
  return nome.replace(/\s*\(Futsal\)/i, '').replace(/\bS(\d{2})\b/g, 'Sub-$1').replace(/[()]/g, '')
    .replace(/´/g, "'").replace(/\s+/g, ' ').trim();
}

export function lerZapping(xml) {
  return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<pubDate>[^<]*?(\d{4})[^<]*<\/pubDate>/g)].map(([, t, ano]) => {
    const m = desfazer(t).match(/^(.+?) x (.+?) - (\d\d)\/(\d\d) (\d\d):(\d\d) - (.+)$/);
    if (!m) return null;
    const [, mandante, visitante, dia, mes, h, min, emissora] = m;
    const inicio = deLisboa(Number(ano), Number(mes), Number(dia), Number(h), Number(min));
    const [hh, mm] = inicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).split(':');
    return {
      esporte: 'futebol',
      data: inicio.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
      horario: `${hh}h${mm}`,
      campeonato: /futsal/i.test(t) ? 'Futsal' : '',
      rodada: '',
      mandante: limparTime(mandante),
      visitante: limparTime(visitante),
      transmissao: emissora.trim(),
      encerrado: false,
      fonte: 'ogol',
    };
  }).filter(Boolean);
}

// Guarda o feed por 10 min (a agenda pede vários dias seguidos)
let cache = { em: 0, jogos: null };
export async function buscarOgol() {
  if (cache.jogos && Date.now() - cache.em < 10 * 60_000) return cache.jogos;
  const res = await fetch(FEED, { headers: CABECALHO });
  if (!res.ok) throw new Error(`oGol respondeu ${res.status}`);
  cache = { em: Date.now(), jogos: lerZapping(await res.text()) };
  return cache.jogos;
}
