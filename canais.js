// Link de cada canal de transmissão: leva pro site/app do canal (não pra partida).
// Quem já tem conta cai direto no ao vivo; quem não tem, faz o cadastro.
// No futuro, dá pra trocar os endereços por links de afiliado aqui.
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

// Canais oficiais no YouTube. O link abre a aba "Ao vivo" do canal, onde fica a live do jogo.
// Os que transmitem só pelo YouTube (CazéTV, GE TV...) usam esse link mesmo sem "YouTube" no nome.
export const YOUTUBE = [
  [/caz[eé]/i, 'CazeTV'],
  [/ge ?tv/i, 'getv'],
  [/x ?sports/i, 'xsports.brasil'],
  [/sporty ?net/i, 'SportyNetBrasil'],
  [/goat/i, 'canalgoatbr'],
  [/uol esporte/i, 'UOLEsporte'],
  [/\bnbb\b/i, 'NBBoficial'],
  [/espn/i, 'ESPNBrasil'],
  [/link alviverde/i, 'LinkAlviverde'],
  [/carioc/i, 'Cariocao'],
  [/n ?sports/i, 'NSports'],
];
const SO_YOUTUBE = /caz[eé]|ge ?tv|sporty ?net|x ?sports|goat|uol esporte/i;

// Canal do YouTube que não está na lista: busca pelo canal + jogo (último recurso)
const buscaYoutube = (canal, jogo) =>
  `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${canal} ${jogo.mandante} x ${jogo.visitante} ao vivo` })}`;

function linkYoutube(canal, jogo) {
  const handle = YOUTUBE.find(([re]) => re.test(canal))?.[1];
  return handle ? `https://www.youtube.com/@${handle}/streams` : buscaYoutube(canal, jogo);
}

// "CazéTV (YouTube)" ou "YouTube (CazéTV)" → nome "CazéTV" e link do canal; "Disney+" → link do Disney+
export function linkCanal(canal, jogo) {
  const yt = canal.match(/^(?:youtube|yt)\s*\((.+)\)$/i) || canal.match(/^(.+?)\s*\(youtube\)$/i);
  if (yt) return { nome: yt[1], link: linkYoutube(yt[1], jogo) };
  if (SO_YOUTUBE.test(canal)) return { nome: canal, link: linkYoutube(canal, jogo) };
  return { nome: canal, link: LINKS.find(([re]) => re.test(canal))?.[1] || '' };
}
