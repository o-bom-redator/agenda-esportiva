// Lê o título de um post de gol do r/soccer e monta a legenda pro canal.
// Ex.: "Milan 2-[4] Bologna - Samuel Mbangula hat trick 86'" →
//   🇮🇹 *Milan 2x4 Bologna* 🇮🇹
//   ⚽ Samuel Mbangula (hat-trick) / 86'
//   🏆 Campeonato Italiano | 9ª Rodada
import { buscarTodos, VIRADA } from './scraper.js';

// "Time A 1-[2] Time B - Jogador 62'" (o placar entre colchetes é de quem marcou)
const TITULO = /^(.+?)\s+(\[?\d+\]?)\s*[-–]\s*(\[?\d+\]?)\s+(.+?)\s+[-–]\s+(.+)$/;

// Detalhes do lance que o r/soccer escreve em inglês
const LANCES = [
  [/\b(own goal|og)\b/i, 'gol contra'],
  [/\b(penalty|pen)\b/i, 'pênalti'],
  [/\bhat[\s-]?trick\b/i, 'hat-trick'],
  [/\bbrace\b/i, '2º gol'],
  [/\bfree[\s-]?kick\b/i, 'falta'],
  [/\b(great|amazing|incredible|stunning|wonder) (goal|strike)\b/i, 'golaço'],
];

export function lerTitulo(titulo) {
  const m = titulo.replace(/\s+/g, ' ').trim().match(TITULO);
  if (!m) return null;
  const [, mandante, p1, p2, visitante, resto] = m;
  const minutos = [...resto.matchAll(/(\d+(?:\s*\+\s*\d+)?)\s*'/g)];
  const minuto = minutos.length ? `${minutos.at(-1)[1].replace(/\s/g, '')}'` : '';
  const lances = LANCES.filter(([re]) => re.test(resto)).map(([, nome]) => nome);
  let autor = resto.replace(/\d+(?:\s*\+\s*\d+)?\s*'/g, '');
  for (const [re] of LANCES) autor = autor.replace(re, '');
  autor = autor.replace(/[()[\],]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    mandante: mandante.trim(),
    visitante: visitante.trim(),
    placar: [p1, p2].map((p) => p.replace(/\D/g, '')),
    marcou: p2.includes('[') ? 'visitante' : p1.includes('[') ? 'mandante' : '',
    autor,
    lances,
    minuto,
  };
}

// ---- Cruzar com a agenda do dia (nomes do futnatv em português, do Reddit em inglês) ----

const APELIDOS = {
  'inter milan': 'internazionale', inter: 'internazionale', psg: 'paris saint germain', 'paris sg': 'paris saint germain',
  'man city': 'manchester city', 'man utd': 'manchester united', 'man united': 'manchester united',
  spurs: 'tottenham', wolves: 'wolverhampton', 'nottm forest': 'nottingham forest',
};
const VAZIAS = new Set(['fc', 'cf', 'ac', 'sc', 'afc', 'cd', 'ud', 'sd', 'de', 'da', 'do', 'del', 'la', 'the', 'club', 'f', 'w', 'women', 'feminino']);

const normalizar = (nome) => {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return (APELIDOS[n] || n).split(' ').filter((p) => p && !VAZIAS.has(p));
};
// Palavras "iguais": idênticas ou com o mesmo começo (munich/munique, milan/milao)
const parecidas = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
function semelhanca(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x.length || !y.length) return 0;
  const comuns = x.filter((p) => y.some((q) => parecidas(p, q))).length;
  return comuns / Math.min(x.length, y.length);
}

export function acharJogo(lance, jogos) {
  let melhor = null, nota = 0;
  for (const j of jogos) {
    const n = semelhanca(lance.mandante, j.mandante) + semelhanca(lance.visitante, j.visitante);
    if (n > nota) [melhor, nota] = [j, n];
  }
  return nota >= 1 ? melhor : null; // pelo menos um time bate inteiro (ou os dois em parte)
}

// Jogos de futebol da agenda atual (até as 5h59 ainda vale a agenda de ontem). Guarda por 20 min.
let cache = { em: 0, jogos: [] };
export async function jogosDeAgora() {
  if (Date.now() - cache.em < 20 * 60_000) return cache.jogos;
  const data = new Date(Date.now() - VIRADA * 3_600_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  cache = { em: Date.now(), jogos: await buscarTodos(['futebol'], data) };
  return cache.jogos;
}

// ---- Legenda ----

const BANDEIRAS = [
  [/italian|copa da it[aá]lia/i, '🇮🇹'], [/ingl[eê]s|copa da liga inglesa|fa cup|copa da inglaterra/i, '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
  [/espanhol|copa do rei/i, '🇪🇸'], [/alem[aã]|copa da alemanha/i, '🇩🇪'], [/franc[eê]s|copa da fran[cç]a/i, '🇫🇷'],
  [/portugu[eê]s|ta[cç]a de portugal/i, '🇵🇹'], [/neerland[eê]s|holand[eê]s/i, '🇳🇱'], [/belga/i, '🇧🇪'],
  [/escoc[eê]s/i, '🏴󠁧󠁢󠁳󠁣󠁴󠁿'], [/turco/i, '🇹🇷'], [/saudita/i, '🇸🇦'], [/argentin/i, '🇦🇷'], [/mexican/i, '🇲🇽'],
  [/uruguai/i, '🇺🇾'], [/russo/i, '🇷🇺'], [/grego/i, '🇬🇷'], [/eg[ií]pcio/i, '🇪🇬'], [/\bmls\b|nwsl/i, '🇺🇸'],
  [/brasileir|paulista|carioca|mineiro|ga[uú]cho|copa do brasil|copa do nordeste/i, '🇧🇷'],
];
const bandeira = (campeonato = '') => BANDEIRAS.find(([re]) => re.test(campeonato))?.[1] || '';

// Formato WhatsApp (*negrito*). Usa os nomes do futnatv quando acha o jogo na agenda.
export function montarLegenda(lance, jogo) {
  const b = bandeira(jogo?.campeonato);
  const casa = jogo?.mandante || lance.mandante;
  const fora = jogo?.visitante || lance.visitante;
  const placar = `${b ? `${b} ` : ''}*${casa} ${lance.placar[0]}x${lance.placar[1]} ${fora}*${b ? ` ${b}` : ''}`;
  const autor = [lance.autor, lance.lances.length ? `(${lance.lances.join(', ')})` : ''].filter(Boolean).join(' ');
  const gol = `⚽ ${[autor, lance.minuto].filter(Boolean).join(' / ')}`;
  const linhas = [placar, gol];
  if (jogo) linhas.push(`🏆 ${jogo.campeonato}${jogo.rodada ? ` | ${jogo.rodada}` : ''}`);
  return linhas.join('\n');
}
