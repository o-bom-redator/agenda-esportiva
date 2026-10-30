// Busca automática dos gols postados no r/futebol (pega bem o Brasileirão, que quase não aparece
// no r/soccer). Lê o feed RSS público dos posts novos a cada 2 min (1 consulta). A busca pela
// etiqueta "Lances" atrasa vários minutos, então filtramos pelo título: só passam posts de gol
// (placar com colchetes, ex. "Bahia [3] x 2 São Paulo") de jogos da nossa agenda.
import fs from 'node:fs';
import path from 'node:path';
import { lerTitulo, acharJogo, jogosDeAgora } from './gols.js';
import { CABECALHO } from './gif.js';
import { temApiOficial, postsNovos } from './reddit.js';

export const FEED = 'https://www.reddit.com/r/futebol/new/.rss';
const INTERVALO = temApiOficial ? 30_000 : 2 * 60_000; // a API oficial aguenta consultas mais frequentes
const RECENTES = 3 * 3_600_000; // posts das últimas 3 h
const TENTAR = 15 * 60_000; // se o vídeo falhar (ainda processando), tenta de novo enquanto o post tiver menos de 15 min

const desfazer = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Cada post do feed: id, título, quando saiu e o link do vídeo
export function lerFeed(xml) {
  return xml.split('<entry>').slice(1).map((e) => ({
    id: e.match(/<id>([^<]+)<\/id>/)?.[1],
    titulo: desfazer(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
    publicado: new Date(e.match(/<published>([^<]+)<\/published>/)?.[1]),
    link: desfazer(desfazer(e).match(/<a href="([^"]+)">\[link\]/)?.[1] || ''),
  })).filter((p) => p.id);
}

function lerEstado(arquivo) {
  try {
    return { novo: false, vistos: new Set(JSON.parse(fs.readFileSync(arquivo, 'utf8'))) };
  } catch {
    return { novo: true, vistos: new Set() };
  }
}

// Mesmos parâmetros do iniciarGols (goalszone.js)
export function iniciarLances({ arquivo, campeonatos = [], entregar, log = console.log }) {
  const estado = lerEstado(arquivo);
  const escolhidos = new Set(campeonatos.map((c) => c.toLowerCase()));
  let primeira = estado.novo; // na primeira vez, só anota o que já existe
  let rodando = false;

  async function verificar() {
    if (rodando) return;
    rodando = true;
    try {
      const todos = await jogosDeAgora().catch(() => []);
      if (!todos.length) return;
      const agenda = todos.filter((j) => !escolhidos.size || escolhidos.has(j.campeonato.toLowerCase()));
      let posts;
      if (temApiOficial) {
        posts = await postsNovos('futebol');
      } else {
        const res = await fetch(FEED, { headers: CABECALHO });
        if (!res.ok) throw new Error(`o Reddit respondeu ${res.status}`);
        posts = lerFeed(await res.text());
      }
      posts.reverse(); // do mais antigo pro mais novo
      for (const p of posts) {
        if (estado.vistos.has(p.id)) continue;
        estado.vistos.add(p.id);
        if (primeira || Date.now() - p.publicado > RECENTES) continue;
        const lance = lerTitulo(p.titulo);
        if (!lance || !p.link || !acharJogo(lance, agenda)) continue; // não é gol ou não é da lista
        try {
          await entregar(p.titulo, [p.link]);
        } catch (e) {
          const deNovo = Date.now() - p.publicado < TENTAR;
          if (deNovo) estado.vistos.delete(p.id);
          log('r/futebol: falha em', p.titulo, '-', e.message, deNovo ? '(vou tentar de novo)' : '');
        }
      }
      if (primeira) log('r/futebol: primeira leitura feita, os próximos gols serão enviados.');
      primeira = false;
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify([...estado.vistos].slice(-1000)));
    } catch (e) {
      log('r/futebol:', e.message);
    } finally {
      rodando = false;
    }
  }

  verificar();
  setInterval(verificar, INTERVALO);
}
