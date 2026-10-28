import puppeteer from 'puppeteer';
import { ESPORTES } from './scraper.js';
import { formatarData, ehHoje, rotuloDia } from './mensagem.js';

export const CORES = { futebol: '#16a34a', basquete: '#ea580c', volei: '#d4a106', nfl: '#2563eb' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Classifica o canal pra dar cor ao "chip": YouTube (grátis), streaming ou TV.
function tipoCanal(canal) {
  if (/youtube|\byt\b|cazé|getv|ge tv/i.test(canal)) return 'yt';
  if (/disney|prime|max|globoplay|paramount|netflix|league pass|dazn|apple|star\+|onefootball|sportynet/i.test(canal)) return 'stream';
  return 'tv';
}

// Separa "ESPN, Globo (BA, SP e parte da rede) e Premiere" em canais,
// sem quebrar o que está dentro de parênteses.
export function separarCanais(transmissao) {
  const canais = [];
  let atual = '';
  let nivel = 0;
  for (let i = 0; i < transmissao.length; i++) {
    const c = transmissao[i];
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (nivel === 0 && (c === ',' || transmissao.startsWith(' e ', i))) {
      canais.push(atual);
      atual = '';
      if (c === ' ') i += 2;
      continue;
    }
    atual += c;
  }
  canais.push(atual);
  return canais.map((c) => c.trim()).filter((c) => c && c !== '<>');
}

export function chips(transmissao) {
  const canais = separarCanais(transmissao || '');
  if (!canais.length) return '<span class="chip tv">A definir</span>';
  return canais.map((c) => `<span class="chip ${tipoCanal(c)}">${esc(c)}</span>`).join('');
}

function linhas(jogos, data) {
  let ultimo = '';
  return jogos.map((j) => {
    const chave = `${j.data} ${j.horario}`;
    const repetido = chave === ultimo;
    ultimo = chave;
    const dia = rotuloDia(j, data); // jogo da madrugada seguinte
    return `
    <div class="row${repetido ? '' : ' novo-horario'}" style="--cor:${CORES[j.esporte]}">
      <div class="hora${repetido ? ' repetida' : ''}">${esc(j.horario)}${dia ? `<div class="dia">${esc(dia)}</div>` : ''}</div>
      <div class="camp">
        <div class="camp-nome"><span class="ico">${ESPORTES[j.esporte].icone}</span>${esc(j.campeonato)}</div>
        ${j.rodada ? `<div class="rodada">${esc(j.rodada)}</div>` : ''}
      </div>
      <div class="jogo"><span>${esc(j.mandante)}</span><span class="x">×</span><span>${esc(j.visitante)}</span></div>
      <div class="canais">${chips(j.transmissao)}</div>
    </div>`;
  }).join('');
}

function html(jogos, data, pagina, totalPaginas, totalJogos, esportesPresentes) {
  const legenda = esportesPresentes
    .map((e) => `<span class="leg" style="--cor:${CORES[e]}">${ESPORTES[e].icone} ${ESPORTES[e].nome}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=block" rel="stylesheet">
  <style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #e9edf2; }
  #card { width: 1080px; background: #f7f8fa; }
  header { background: linear-gradient(120deg, #0b1f3a 0%, #13315c 60%, #1d4e89 100%); color: #fff; padding: 34px 40px 28px; position: relative; overflow: hidden; }
  header::after { content: ''; position: absolute; right: -60px; top: -80px; width: 320px; height: 320px; border-radius: 50%; background: rgba(255,255,255,.05); }
  .kicker { font-size: 15px; letter-spacing: 3px; font-weight: 700; color: #8fb8ff; text-transform: uppercase; }
  h1 { font-size: 46px; font-weight: 900; letter-spacing: -1px; margin-top: 4px; }
  .sub { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .data { font-size: 22px; font-weight: 600; color: #dbe7ff; }
  .legenda { display: flex; gap: 8px; }
  .leg { font-size: 15px; font-weight: 700; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,.1); border-left: 4px solid var(--cor); }
  .cols { display: grid; grid-template-columns: 96px 290px 1fr 250px; padding: 12px 24px 10px 30px; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #8a94a6; text-transform: uppercase; }
  .lista { padding: 0 16px 8px; }
  .row { display: grid; grid-template-columns: 96px 290px 1fr 250px; align-items: center; min-height: 64px; padding: 8px 8px 8px 14px; margin-bottom: 6px; background: #fff; border-radius: 12px; border-left: 6px solid var(--cor); box-shadow: 0 1px 2px rgba(16,24,40,.06); }
  .row.novo-horario:not(:first-child) { margin-top: 12px; }
  .hora { font-size: 26px; font-weight: 900; color: #0b1f3a; font-variant-numeric: tabular-nums; }
  .hora.repetida { color: #c3cad5; }
  .dia { font-size: 12px; font-weight: 800; color: #fff; background: #13315c; border-radius: 6px; padding: 2px 6px; margin-top: 3px; display: inline-block; letter-spacing: .3px; }
  .camp-nome { font-size: 16px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px; line-height: 1.2; }
  .ico { font-size: 18px; }
  .rodada { font-size: 13px; color: #8a94a6; margin: 3px 0 0 28px; }
  .jogo { font-size: 21px; font-weight: 800; color: #111827; display: flex; flex-wrap: wrap; align-items: center; gap: 0 10px; padding-right: 10px; line-height: 1.25; }
  .x { color: var(--cor); font-weight: 900; }
  .canais { display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end; }
  .chip { font-size: 13.5px; font-weight: 700; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }
  .chip.tv { background: #e8eef7; color: #1e3a5f; }
  .chip.stream { background: #efe9fb; color: #5b21b6; }
  .chip.yt { background: #fde8e8; color: #b91c1c; }
  footer { display: flex; justify-content: space-between; padding: 14px 40px 22px; font-size: 14px; color: #8a94a6; font-weight: 600; }
  </style></head><body><div id="card">
  <header>
    <div class="kicker">Agenda esportiva na TV</div>
    <h1>${ehHoje(data) ? 'Jogos de hoje' : 'Jogos do dia'}</h1>
    <div class="sub"><div class="data">📅 ${esc(formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${totalJogos} jogos</div><div class="legenda">${legenda}</div></div>
  </header>
  <div class="cols"><div>Hora</div><div>Campeonato</div><div>Jogo</div><div style="text-align:right">Onde assistir</div></div>
  <div class="lista">${linhas(jogos, data)}</div>
  <footer><span>Horários de Brasília · Fonte: futnatv.net</span><span>${totalPaginas > 1 ? `Parte ${pagina} de ${totalPaginas}` : ''}</span></footer>
  </div></body></html>`;
}

// Gera uma ou mais imagens PNG (divide em partes se tiver muitos jogos).
export async function gerarImagens(jogos, data, { jogosPorImagem = 22 } = {}) {
  const partes = Math.max(1, Math.ceil(jogos.length / jogosPorImagem));
  const porParte = Math.ceil(jogos.length / partes) || 1;
  const esportesPresentes = Object.keys(ESPORTES).filter((e) => jogos.some((j) => j.esporte === e));

  // --no-sandbox é necessário no servidor Linux do GitHub Actions
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1000, deviceScaleFactor: 2 });
    const imagens = [];
    for (let i = 0; i < partes; i++) {
      const fatia = jogos.slice(i * porParte, (i + 1) * porParte);
      await page.setContent(html(fatia, data, i + 1, partes, jogos.length, esportesPresentes), { waitUntil: 'load', timeout: 20_000 });
      // espera a fonte Inter carregar (no máximo 5 s; se falhar, usa a fonte do sistema)
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]));
      const card = await page.$('#card');
      imagens.push(Buffer.from(await card.screenshot({ type: 'png' })));
    }
    return imagens;
  } finally {
    await browser.close();
  }
}
