// Página da agenda (site/index.html): cada jogo tem um botão "Salvar no Google Agenda".
// Também gera site/agenda.ics com todos os jogos (pra iPhone/Outlook).
import { ESPORTES } from './scraper.js';
import { formatarData, ehHoje, rotuloDia } from './mensagem.js';
import { CORES, esc, chips, separarCanais } from './imagem.js';

// Duração estimada de cada esporte, em minutos (só pra bloquear o horário na agenda)
const DURACAO = { futebol: 120, basquete: 150, volei: 120, nfl: 210 };

// Início e fim do jogo como "AAAAMMDDTHHMMSS" (hora de Brasília, sem fuso),
// no dia real do jogo (os da madrugada já vêm com a data do dia seguinte).
function horarios(jogo) {
  const [h, m] = jogo.horario.split('h').map(Number);
  const inicio = new Date(`${jogo.data}T00:00:00Z`);
  inicio.setUTCHours(h, m || 0);
  const fim = new Date(inicio.getTime() + DURACAO[jogo.esporte] * 60_000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
  return [fmt(inicio), fmt(fim)];
}

const titulo = (j) => `${ESPORTES[j.esporte].icone} ${j.mandante} x ${j.visitante}`;
const detalhes = (j) =>
  `${j.campeonato}${j.rodada ? ` · ${j.rodada}` : ''}\nOnde assistir: ${separarCanais(j.transmissao).join(', ')}\n\nAgenda do dia: futnatv.net`;

export function linkGoogleAgenda(jogo, data) {
  const [inicio, fim] = horarios(jogo);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo(jogo),
    dates: `${inicio}/${fim}`,
    ctz: 'America/Sao_Paulo',
    details: detalhes(jogo),
    location: separarCanais(jogo.transmissao).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function gerarIcs(jogos, data) {
  const linha = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const eventos = jogos.map((j, i) => {
    const [inicio, fim] = horarios(j);
    return [
      'BEGIN:VEVENT',
      `UID:${data}-${i}@agenda-esportiva`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;TZID=America/Sao_Paulo:${inicio}`,
      `DTEND;TZID=America/Sao_Paulo:${fim}`,
      `SUMMARY:${linha(titulo(j))}`,
      `DESCRIPTION:${linha(detalhes(j))}`,
      `LOCATION:${linha(separarCanais(j.transmissao).join(', '))}`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//agenda-esportiva//PT-BR', 'CALSCALE:GREGORIAN', ...eventos, 'END:VCALENDAR', ''].join('\r\n');
}

export function gerarPagina(jogos, data) {
  const dia = formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' });
  const titulo = ehHoje(data) ? 'Jogos de hoje' : 'Jogos do dia';
  const esportesPresentes = Object.keys(ESPORTES).filter((e) => jogos.some((j) => j.esporte === e));

  const filtros = esportesPresentes.length > 1
    ? `<nav class="filtros"><button class="ativo" data-esporte="">Todos</button>${esportesPresentes
      .map((e) => `<button data-esporte="${e}" style="--cor:${CORES[e]}">${ESPORTES[e].icone} ${ESPORTES[e].nome}</button>`).join('')}</nav>`
    : '';

  let ultimo = '';
  const cards = jogos.map((j) => {
    const chave = `${j.data} ${j.horario}`;
    const novo = chave !== ultimo;
    ultimo = chave;
    const dia = rotuloDia(j, data); // jogo da madrugada seguinte
    return `${novo ? `<h2 class="hora">${esc(j.horario)}${dia ? ` <span>madrugada · ${esc(dia)}</span>` : ''}</h2>` : ''}
    <article class="jogo" data-esporte="${j.esporte}" style="--cor:${CORES[j.esporte]}">
      <div class="camp">${ESPORTES[j.esporte].icone} ${esc(j.campeonato)}${j.rodada ? ` <span>· ${esc(j.rodada)}</span>` : ''}</div>
      <div class="times">${esc(j.mandante)} <b>×</b> ${esc(j.visitante)}</div>
      <div class="rodape">
        <div class="canais">${chips(j.transmissao)}</div>
        <a class="salvar" href="${esc(linkGoogleAgenda(j, data))}" target="_blank" rel="noopener">📅 Salvar na agenda</a>
      </div>
    </article>`;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agenda esportiva: ${esc(dia)}</title>
<meta name="description" content="${jogos.length} jogos na TV e no streaming: ${esc(dia)}">
<meta property="og:title" content="${titulo} na TV: ${esc(dia)}">
<meta property="og:description" content="${jogos.length} jogos com horário e onde assistir. Toque no jogo pra salvar na sua agenda.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --fundo: #f3f5f8; --card: #fff; --texto: #111827; --suave: #6b7280; --linha: #e5e7eb;
    --tv-bg: #e8eef7; --tv: #1e3a5f; --st-bg: #efe9fb; --st: #5b21b6; --yt-bg: #fde8e8; --yt: #b91c1c; }
  @media (prefers-color-scheme: dark) {
    :root { --fundo: #0b1220; --card: #151e2e; --texto: #f3f4f6; --suave: #9ca3af; --linha: #253047;
      --tv-bg: #1e2a3d; --tv: #bcd3f5; --st-bg: #2a2140; --st: #c8b2f5; --yt-bg: #3a1d22; --yt: #fca5a5; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif; background: var(--fundo); color: var(--texto); }
  header { background: linear-gradient(120deg, #0b1f3a 0%, #13315c 60%, #1d4e89 100%); color: #fff; padding: 28px 16px 22px; }
  .wrap { max-width: 720px; margin: 0 auto; }
  .kicker { font-size: 12px; letter-spacing: 2.5px; font-weight: 700; color: #8fb8ff; text-transform: uppercase; }
  h1 { font-size: 32px; font-weight: 900; letter-spacing: -.5px; margin-top: 2px; }
  .data { font-size: 16px; color: #dbe7ff; margin-top: 6px; font-weight: 600; }
  .dica { font-size: 13px; color: #a9c4ee; margin-top: 10px; }
  .dica a { color: #fff; }
  .filtros { display: flex; gap: 8px; overflow-x: auto; padding: 14px 16px 4px; max-width: 720px; margin: 0 auto; }
  .filtros button { font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--linha); background: var(--card); color: var(--texto);
    padding: 7px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
  .filtros button.ativo { background: #13315c; color: #fff; border-color: #13315c; }
  main { padding: 4px 16px 32px; }
  .hora span { font-size: 13px; font-weight: 800; color: #fff; background: #13315c; border-radius: 6px; padding: 3px 8px; vertical-align: middle; margin-left: 6px; }
  .hora { font-size: 20px; font-weight: 900; margin: 20px 0 8px; font-variant-numeric: tabular-nums; }
  .jogo { background: var(--card); border-radius: 14px; border-left: 5px solid var(--cor); padding: 12px 14px; margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(16,24,40,.06); }
  .camp { font-size: 13px; font-weight: 700; color: var(--suave); }
  .camp span { font-weight: 500; }
  .times { font-size: 18px; font-weight: 800; margin: 4px 0 10px; line-height: 1.3; }
  .times b { color: var(--cor); }
  .rodape { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .canais { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { font-size: 12.5px; font-weight: 700; padding: 4px 9px; border-radius: 7px; white-space: nowrap; }
  .chip.tv { background: var(--tv-bg); color: var(--tv); }
  .chip.stream { background: var(--st-bg); color: var(--st); }
  .chip.yt { background: var(--yt-bg); color: var(--yt); }
  .salvar { font-size: 14px; font-weight: 800; text-decoration: none; color: #fff; background: #1a73e8; padding: 8px 14px; border-radius: 10px; white-space: nowrap; }
  .salvar:active { transform: scale(.97); }
  .vazio { text-align: center; color: var(--suave); padding: 40px 0; }
  footer { text-align: center; font-size: 13px; color: var(--suave); padding: 0 16px 32px; }
  [hidden] { display: none !important; }
</style>
</head><body>
<header><div class="wrap">
  <div class="kicker">Agenda esportiva na TV</div>
  <h1>${titulo}</h1>
  <div class="data">📅 ${esc(dia)} · ${jogos.length} jogos · horários de Brasília</div>
  <div class="dica">Toque em "Salvar na agenda" pra adicionar o jogo no Google Agenda, ou <a href="agenda.ics">baixe todos (.ics)</a>.</div>
</div></header>
${filtros}
<main class="wrap">${cards || '<p class="vazio">Nenhum jogo com transmissão encontrado.</p>'}</main>
<footer>Fonte: futnatv.net</footer>
<script>
  document.querySelectorAll('.filtros button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filtros button').forEach((x) => x.classList.toggle('ativo', x === b));
    const esporte = b.dataset.esporte;
    document.querySelectorAll('.jogo').forEach((j) => { j.hidden = esporte && j.dataset.esporte !== esporte; });
    // esconde os horários que ficaram sem jogo visível
    document.querySelectorAll('.hora').forEach((h) => {
      let el = h.nextElementSibling, algum = false;
      while (el && el.classList.contains('jogo')) { if (!el.hidden) algum = true; el = el.nextElementSibling; }
      h.hidden = !algum;
    });
  }));
</script>
</body></html>
`;
}
