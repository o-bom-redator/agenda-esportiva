// Baixa o vídeo de um link (streamin, streamain ou .mp4 direto) e converte pra GIF (vídeo sem som).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';

const rodar = promisify(execFile);
const LIMITE = 50 * 1024 * 1024; // 50 MB

// Vídeo do próprio Reddit (v.redd.it): a lista de qualidades (DASH) aponta os .mp4 só de imagem.
// Pega o maior até 720p (o som não importa, o GIF é mudo).
export const CABECALHO = { 'User-Agent': 'agenda-esportiva-bot/1.0 (+https://github.com/o-bom-redator/agenda-esportiva)' };
async function videoDoReddit(id) {
  const res = await fetch(`https://v.redd.it/${id}/DASHPlaylist.mpd`, { headers: CABECALHO });
  if (!res.ok) throw new Error(`o Reddit respondeu ${res.status} pro vídeo`);
  const xml = await res.text();
  const opcoes = [...xml.matchAll(/<Representation[^>]*\bheight="(\d+)"[^>]*>\s*<BaseURL>([^<]+)<\/BaseURL>/g)]
    .map(([, altura, arquivo]) => ({ altura: Number(altura), arquivo }))
    .sort((a, b) => b.altura - a.altura);
  const melhor = opcoes.find((o) => o.altura <= 720) || opcoes.at(-1);
  if (!melhor) throw new Error('não achei o vídeo no Reddit');
  return `https://v.redd.it/${id}/${melhor.arquivo}`;
}

// Acha o endereço do .mp4 dentro da página do vídeo.
// streama.in e streamain.com mostram o vídeo numa página "embed" separada: segue até ela.
export async function acharVideo(link, tentativas = 2) {
  const reddit = link.match(/v\.redd\.it\/(\w+)/);
  if (reddit) return videoDoReddit(reddit[1]);
  if (/\.(mp4|webm|mov|gif)(\?|$)/i.test(link)) return link; // .gif também: o ffmpeg converte
  const sa = link.match(/streama(?:in\.com|\.in)\/(?:\w{2}\/)?([A-Za-z0-9]+)\/watch/);
  const pagina = sa ? `https://streamain.com/embed/${sa[1]}` : link;

  const res = await fetch(pagina, { redirect: 'follow' });
  if (!res.ok) throw new Error(`a página do vídeo respondeu ${res.status}`);
  const html = await res.text();
  const achado =
    html.match(/<meta[^>]+property=['"]og:video(?::url|:secure_url)?['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
    html.match(/<video[^>]+data-link=['"]([^'"]+)['"]/i)?.[1] ||
    html.match(/<source[^>]+src=['"]([^'"]+)['"]/i)?.[1] ||
    html.match(/<video[^>]+src=['"]([^'"]+)['"]/i)?.[1];
  if (achado) return new URL(achado.replace(/&amp;/g, '&'), res.url).href;
  const embed = html.match(/["'](\/embed\/[A-Za-z0-9]+)["']/)?.[1];
  if (embed && tentativas > 1) return acharVideo(new URL(embed, res.url).href, tentativas - 1);
  throw new Error('não achei o vídeo nessa página');
}

// Gera animacao.mp4 numa pasta temporária: sem som, até 720px (o Telegram mostra como GIF)
export async function fazerGif(link) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gol-'));
  const video = path.join(pasta, 'original.mp4');

  const res = await fetch(await acharVideo(link), { headers: CABECALHO });
  if (!res.ok) throw new Error(`o vídeo respondeu ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > LIMITE) throw new Error('vídeo grande demais (mais de 50 MB)');
  fs.writeFileSync(video, bytes);

  const animacao = path.join(pasta, 'animacao.mp4');
  await rodar(ffmpeg, ['-y', '-v', 'error', '-i', video, '-an', '-vf', "fps=30,scale='min(720,iw)':-2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', animacao]);
  return { pasta, animacao };
}
