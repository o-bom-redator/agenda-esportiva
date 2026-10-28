// Link de cada canal de transmissão: leva pro site/app do canal (não pra partida).
// Quem já tem conta cai direto no ao vivo; quem não tem, faz o cadastro.
// No futuro, dá pra trocar os endereços por links de afiliado aqui.
//
// Canais do YouTube ("YouTube (CazéTV)", "YT (GE TV)") viram uma busca pelo canal + jogo,
// que traz a live da partida no topo.
export const LINKS = [
  [/disney|espn|star\+/i, 'https://www.disneyplus.com/pt-br'],
  [/sportv|globo|premiere/i, 'https://globoplay.globo.com'],
  [/hbo|max\b|tnt/i, 'https://www.hbomax.com/br'],
  [/prime video|amazon/i, 'https://www.primevideo.com'],
  [/paramount/i, 'https://www.paramountplus.com/br/'],
  [/apple tv/i, 'https://tv.apple.com/br'],
  [/league pass/i, 'https://www.nba.com/watch'],
  [/dazn/i, 'https://www.dazn.com/pt-BR'],
  [/n ?sports/i, 'https://www.nsports.com.br'],
  [/record/i, 'https://recordplus.com'],
  [/\bsbt\b/i, 'https://www.sbt.com.br/ao-vivo'],
  [/\bband\b/i, 'https://www.band.uol.com.br'],
];

// Canais que transmitem principalmente pelo YouTube, mesmo quando o futnatv não escreve "YouTube"
const SO_YOUTUBE = /caz[eé]|ge ?tv|sporty ?net|x ?sports|goat|uol esporte/i;

const buscaYoutube = (canal, jogo) =>
  `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${canal} ${jogo.mandante} x ${jogo.visitante} ao vivo` })}`;

// "YouTube (CazéTV)" → nome "CazéTV" e link de busca; "Disney+" → link do Disney+
export function linkCanal(canal, jogo) {
  const yt = canal.match(/^(?:youtube|yt)\s*\((.+)\)$/i);
  if (yt) return { nome: yt[1], link: buscaYoutube(yt[1], jogo) };
  if (SO_YOUTUBE.test(canal)) return { nome: canal, link: buscaYoutube(canal, jogo) };
  return { nome: canal, link: LINKS.find(([re]) => re.test(canal))?.[1] || '' };
}
