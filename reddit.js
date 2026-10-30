// Acesso oficial ao Reddit (OAuth "só do app", sem login de usuário). O Reddit bloqueia leitura
// sem login vinda de servidores de nuvem (403 no GitHub desde 30/10), então, quando há
// REDDIT_CLIENT_ID e REDDIT_CLIENT_SECRET, lemos os posts pela API oficial (oauth.reddit.com).
// Sem as chaves, cai no feed RSS público (funciona no Mac, mas pode levar 403 no GitHub).
import { CABECALHO } from './gif.js';

const ID = process.env.REDDIT_CLIENT_ID;
const SEGREDO = process.env.REDDIT_CLIENT_SECRET;
export const temApiOficial = Boolean(ID && SEGREDO);

let token = { valor: '', ate: 0 };
async function pegarToken() {
  if (Date.now() < token.ate) return token.valor;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { ...CABECALHO, Authorization: `Basic ${Buffer.from(`${ID}:${SEGREDO}`).toString('base64')}` },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`o Reddit recusou as chaves (${res.status})`);
  const j = await res.json();
  token = { valor: j.access_token, ate: Date.now() + (j.expires_in - 300) * 1000 };
  return token.valor;
}

// Posts novos de um subreddit, no mesmo formato do lerFeed (rfutebol.js): id, titulo, publicado, link.
// Vídeo do próprio Reddit vem com o .mp4 direto (fallback_url), sem precisar da lista DASH.
export async function postsNovos(sub, limite = 50) {
  const res = await fetch(`https://oauth.reddit.com/r/${sub}/new?limit=${limite}&raw_json=1`, {
    headers: { ...CABECALHO, Authorization: `Bearer ${await pegarToken()}` },
  });
  if (res.status === 401) token.ate = 0; // token venceu: pega outro na próxima
  if (!res.ok) throw new Error(`o Reddit respondeu ${res.status}`);
  const j = await res.json();
  return j.data.children.map(({ data: p }) => ({
    id: p.name,
    titulo: p.title,
    publicado: new Date(p.created_utc * 1000),
    link: p.secure_media?.reddit_video?.fallback_url || p.media?.reddit_video?.fallback_url || p.url_overridden_by_dest || p.url || '',
  }));
}

// Link .mp4 direto do vídeo de um post (id em base36, sem o "t3_"), pros clipes que vêm do goals.zone
export async function videoDoPost(id) {
  const res = await fetch(`https://oauth.reddit.com/api/info?id=t3_${id}&raw_json=1`, {
    headers: { ...CABECALHO, Authorization: `Bearer ${await pegarToken()}` },
  });
  if (!res.ok) throw new Error(`o Reddit respondeu ${res.status}`);
  const p = (await res.json()).data.children[0]?.data;
  return p?.secure_media?.reddit_video?.fallback_url || p?.media?.reddit_video?.fallback_url || '';
}
