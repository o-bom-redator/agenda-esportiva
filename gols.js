// Lê o título de um post de gol do r/soccer e monta a legenda pro canal.
// Ex.: "Milan 2-[4] Bologna - Samuel Mbangula hat trick 86'" →
//   🇮🇹 *Milan 2x4 Bologna* 🇮🇹
//   ⚽ Samuel Mbangula (hat-trick) / 86'
//   🏆 Campeonato Italiano | 9ª Rodada
import { buscarTodos, VIRADA } from './scraper.js';

// O placar entre colchetes é de quem marcou. Formatos aceitos:
//   r/soccer:  "Time A 1-[2] Time B - Jogador 62'"
//   r/futebol: "Time A 2 x [2] Time B | 50' Jogador"
//              "Jogador (10') | Time A [2] x 0 Time B | 🏆 Brasileirão Série A – 33ª rodada"
//              "Time A [2] x 0 Time B - Jogador 51' - Brasileirão, Rodada 33"
const PLACAR = /^(.+?)\s+(\[?\d+\]?)\s*(?:x|[-–])\s*(\[?\d+\]?)\s+(.+)$/i;
// Separa os pedaços do título em " | " e " - " (mas não o "-" do placar, como em "0 - [1]")
const PEDACOS = /\s+\|\s+|\s+[-–]\s+(?![[(]?\d)/;
// Pedaço que só diz o campeonato/rodada
const CAMPEONATO = /🏆|rodada|round|matchday|brasileir|campeonato|copa|liga|league|libertadores|s[ée]rie [ab]/i;

// Detalhes do lance (o r/soccer escreve em inglês, o r/futebol em português)
const LANCES = [
  [/\b(own goal|og|gol contra)\b/i, 'gol contra'],
  [/\b(penalty|pen|p[eê]nalti)\b/i, 'pênalti'],
  [/\bhat[\s-]?trick\b/i, 'hat-trick'],
  [/\bbrace\b/i, '2º gol'],
  [/\bfree[\s-]?kick\b|\bde falta\b/i, 'falta'],
  [/\b(great|amazing|incredible|stunning|wonder) (goal|strike)\b|golaço/i, 'golaço'],
];

export function lerTitulo(titulo) {
  const pedacos = titulo.replace(/\s+/g, ' ').trim().split(PEDACOS);
  // o colchete tem que estar no placar (não vale "[Post-Match Thread] ... Bahia 3 x 2 São Paulo")
  const i = pedacos.findIndex((p) => `${p.match(PLACAR)?.[2]}${p.match(PLACAR)?.[3]}`.includes('['));
  if (i < 0) return null;
  const [, mandante, p1, p2, visitante] = pedacos[i].match(PLACAR);
  let resto = pedacos.filter((p, n) => n !== i && !CAMPEONATO.test(p)).join(' ');
  // 86' | 45+2' | 90'+4' | 35’2T (= 80')
  const MINUTO = /(\d+)'?(?:\s*\+\s*(\d+))?\s*'/g;
  resto = resto.replace(/[’‘´]/g, "'")
    .replace(/(\d+)\s*'?\s*\/?\s*([12])\s*T\b/gi, (_, n, t) => `${t === '2' && Number(n) <= 45 ? Number(n) + 45 : n}'`);
  const ultimo = [...resto.matchAll(MINUTO)].at(-1);
  const minuto = ultimo ? `${ultimo[1]}${ultimo[2] ? `+${ultimo[2]}` : ''}'` : '';
  const lances = LANCES.filter(([re]) => re.test(resto)).map(([, nome]) => nome);
  let autor = resto.replace(MINUTO, '');
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
// Siglas e palavras que não ajudam a identificar o time (FC, SSC, VfB, "1. FC", "Bayer 04"...)
const VAZIAS = new Set(['fc', 'cf', 'ac', 'sc', 'afc', 'cd', 'ud', 'sd', 'ssc', 'vfl', 'vfb', 'tsg', 'sv', 'ssv', 'sg', 'bsc', 'us', 'as',
  'calcio', 'de', 'da', 'do', 'del', 'la', 'the', 'club', 'f', 'w', 'women', 'feminino', '1', '04', '05']);

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
