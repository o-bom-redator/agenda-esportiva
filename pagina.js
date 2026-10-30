// Página da agenda (site/index.html): cada jogo tem um botão "Salvar no Google Agenda".
// Também gera site/agenda.ics com todos os jogos (pra iPhone/Outlook).
import { ESPORTES } from './scraper.js';
import { formatarData, ehHoje, rotuloDia } from './mensagem.js';
import { CORES, esc, separarCanais, tipoCanal } from './imagem.js';
import { emissoraDoFiltro } from './emissoras.js';

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
  `${j.campeonato}${j.rodada ? ` · ${j.rodada}` : ''}\nOnde assistir: ${separarCanais(j.transmissao).join(', ')}`;

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

// "CazéTV (YouTube)" → "cazetv": endereço da emissora na página (.../#cazetv)
const slug = (nome) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Chips de "onde assistir": cada um leva aos jogos daquela emissora nos próximos dias
function chipsComLink(transmissao) {
  const canais = separarCanais(transmissao || '');
  if (!canais.length) return '<span class="chip tv">A definir</span>';
  return canais.map((c) => `<a class="chip ${tipoCanal(c)}" href="#canal/${slug(emissoraDoFiltro(c))}">${esc(c)}</a>`).join('');
}

const CALENDARIO = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z"/></svg>';

// Início do jogo com fuso ("2026-10-30T15:00:00-03:00"), pro selo "Ao vivo" que o navegador liga e desliga
const inicioIso = (j) => `${j.data}T${j.horario.replace('h', ':').padEnd(5, '0')}:00-03:00`;
const AO_VIVO = '<span class="aovivo" hidden><span class="pulso"></span>Ao vivo</span>';

// Jogos dos próximos dias, enxutos, pro filtro por emissora (o navegador monta os cards)
function dadosDaSemana(semana) {
  return semana.flatMap(({ data, jogos }) => jogos.map((j) => ({
    a: data, d: j.data, h: j.horario, e: j.esporte, c: j.campeonato, r: j.rodada, m: j.mandante, v: j.visitante,
    t: separarCanais(j.transmissao),
  })));
}

// `opcoes.modelo`: 'partidas' = prévia do site "Partidas do Dia" (header com busca e menus); vazio = página atual
export function gerarPagina(jogos, data, semana = [{ data, jogos }], opcoes = {}) {
  const partidas = opcoes.modelo === 'partidas';
  const dia = formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' });
  const titulo = ehHoje(data) ? 'Jogos de hoje' : 'Jogos do dia';
  const esportesPresentes = Object.keys(ESPORTES).filter((e) => jogos.some((j) => j.esporte === e));

  const filtros = esportesPresentes.length > 1
    ? `<nav class="filtros"><button class="ativo" data-esporte="">Todos</button>${esportesPresentes
      .map((e) => `<button data-esporte="${e}" style="--cor:${CORES[e]}">${ESPORTES[e].icone} ${ESPORTES[e].nome}</button>`).join('')}</nav>`
    : '<div style="height:16px"></div>';

  const dados = dadosDaSemana(semana);
  const contagem = new Map();
  for (const j of dados) for (const e of new Set(j.t.map(emissoraDoFiltro))) contagem.set(e, (contagem.get(e) || 0) + 1);
  const emissoras = [...contagem].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  const dias = semana.length;
  const seletor = `<div class="emissora"><label for="emissora">Onde assistir</label><select id="emissora">
    <option value="">Todas as emissoras (${ehHoje(data) ? 'hoje' : 'este dia'})</option>${emissoras
    .map(([e, n]) => `<option value="${slug(e)}">${esc(e)} (${n})</option>`).join('')}</select>
    <span>jogos de uma emissora nos próximos ${dias} dias</span></div>`;

  const cabecalho = partidas ? cabecalhoPartidas(dadosDaSemana(semana), dias) : '';

  // Um bloco por horário, com os jogos em lista
  const horarios = [];
  for (const j of jogos) {
    const chave = `${j.data} ${j.horario}`;
    if (horarios.at(-1)?.chave !== chave) horarios.push({ chave, jogo: j, jogos: [] });
    horarios.at(-1).jogos.push(j);
  }
  const cards = horarios.map(({ jogo, jogos: doHorario }) => {
    const dia = rotuloDia(jogo, data); // jogo da madrugada seguinte
    return `<section class="bloco">
    <h2 class="hora"><time>${esc(jogo.horario)}</time>${dia ? ` <span class="selo">madrugada · ${esc(dia)}</span>` : ''}</h2>
    <div class="lista">${doHorario.map((j) => `
      <article class="jogo" data-esporte="${j.esporte}" data-inicio="${inicioIso(j)}" data-duracao="${DURACAO[j.esporte]}" style="--cor:${CORES[j.esporte]}">
        <div class="info">
          <div class="camp"><span class="ponto"></span>${esc(j.campeonato)}${j.rodada ? ` <span>· ${esc(j.rodada)}</span>` : ''}${AO_VIVO}</div>
          <div class="times">${esc(j.mandante)} <span class="x">×</span> ${esc(j.visitante)}</div>
        </div>
        <div class="acoes">
          <div class="canais">${chipsComLink(j.transmissao)}</div>
          <a class="botao agenda" href="${esc(linkGoogleAgenda(j, data))}" target="_blank" rel="noopener">${CALENDARIO}Salvar na agenda</a>
        </div>
      </article>`).join('')}
    </div></section>`;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${partidas ? `Partidas do Dia: ${esc(dia)}` : `Agenda esportiva: ${esc(dia)}`}</title>
<meta name="description" content="${jogos.length} jogos na TV e no streaming: ${esc(dia)}">
<meta property="og:title" content="${titulo} na TV: ${esc(dia)}">
<meta property="og:description" content="${jogos.length} jogos com horário e onde assistir. Toque no jogo pra salvar na sua agenda.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  /* Visual inspirado no "Octo Code": escuro primeiro, camadas de cor em vez de sombra, raio 6px, peso até 600 */
  :root { color-scheme: dark;
    --fundo: #0d1117; --card: #161b22; --elevado: #1c2128; --linha: #30363d; --linha-forte: #484f58;
    --texto: #e6edf3; --suave: #8b949e; --apagado: #484f58; --link: #58a6ff; --primaria: #2f81f7; --destaque: #f78166;
    --tv: #58a6ff; --stream: #bc8cff; --yt: #f85149; }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) { color-scheme: light;
      --fundo: #ffffff; --card: #f6f8fa; --elevado: #eaeef2; --linha: #d0d7de; --linha-forte: #afb8c1;
      --texto: #1f2328; --suave: #656d76; --apagado: #8c959f; --link: #0969da; --primaria: #0969da; --destaque: #fd8c73;
      --tv: #0969da; --stream: #8250df; --yt: #cf222e; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 400 14px/1.5 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif; background: var(--fundo); color: var(--texto); }
  .wrap { max-width: 768px; margin: 0 auto; padding: 0 16px; }
  a { color: var(--link); }
  time, .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-ligatures: contextual; }

  /* Topo */
  header { background: var(--card); border-bottom: 1px solid var(--linha); padding: 20px 0 0; }
  .kicker { font-size: 12px; font-weight: 500; color: var(--suave); }
  .kicker b { color: var(--texto); font-weight: 600; }
  h1 { font-size: 24px; font-weight: 600; letter-spacing: -.02em; margin-top: 4px; }
  .data { font-size: 14px; color: var(--suave); margin-top: 2px; }
  .data b { color: var(--texto); font-weight: 600; }
  .dica { font-size: 12px; color: var(--suave); margin-top: 8px; }

  /* Abas de esporte (sublinhado laranja na ativa) */
  .filtros { display: flex; gap: 4px; overflow-x: auto; margin-top: 12px; scrollbar-width: none; }
  .filtros button { font: inherit; font-size: 14px; font-weight: 500; background: none; border: 0; color: var(--suave);
    padding: 8px 12px; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: color .1s; }
  .filtros button:hover { color: var(--texto); }
  .filtros button.ativo { color: var(--texto); font-weight: 600; border-bottom-color: var(--destaque); }

  /* Seletor de emissora */
  .emissora { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 16px 0 4px; }
  .emissora label { font-size: 14px; font-weight: 600; }
  .emissora select { font: inherit; font-size: 14px; color: var(--texto); background: var(--fundo); border: 1px solid var(--linha);
    border-radius: 6px; padding: 5px 12px; height: 32px; max-width: 100%; }
  .emissora select:focus { outline: 2px solid var(--primaria); outline-offset: 2px; }
  .emissora span { color: var(--suave); font-size: 12px; }

  main { padding-bottom: 48px; }
  [hidden] { display: none !important; }
  .vazio { text-align: center; color: var(--suave); padding: 40px 0; }

  /* Horários e listas de jogos */
  .bloco { margin-top: 24px; }
  .hora { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .selo { font: 500 12px 'Inter', sans-serif; color: var(--suave); background: var(--elevado); border: 1px solid var(--linha);
    border-radius: 9999px; padding: 1px 10px; }
  .lista, .grupo { background: var(--card); border: 1px solid var(--linha); border-radius: 6px; overflow: hidden; }
  .jogo { display: flex; gap: 8px 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 12px 16px; }
  .jogo + .jogo { border-top: 1px solid var(--linha); }
  .jogo:hover { background: var(--elevado); }
  .camp { font-size: 12px; color: var(--suave); display: flex; align-items: center; gap: 6px; }
  .ponto { width: 10px; height: 10px; border-radius: 50%; background: var(--cor); flex: none; }
  .times { font-size: 16px; font-weight: 600; margin-top: 2px; }
  .times .x { color: var(--apagado); font-weight: 400; margin: 0 2px; }
  .acoes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .canais { display: flex; flex-wrap: wrap; gap: 4px; }

  /* Chips (pílulas): cor com fundo a 15% */
  .chip { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 9999px; font-size: 12px; font-weight: 500;
    white-space: nowrap; text-decoration: none; border: 1px solid transparent; transition: border-color .1s; }
  .chip.tv { color: var(--tv); background: color-mix(in srgb, var(--tv) 15%, transparent); }
  .chip.stream { color: var(--stream); background: color-mix(in srgb, var(--stream) 15%, transparent); }
  .chip.yt { color: var(--yt); background: color-mix(in srgb, var(--yt) 15%, transparent); }
  a.chip:hover { border-color: currentColor; }
  .chip.sel { border-color: currentColor; }

  /* Botão de contorno */
  .botao { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
    color: var(--texto); background: var(--elevado); border: 1px solid var(--linha); text-decoration: none; white-space: nowrap; transition: border-color .1s; }
  .botao:hover { border-color: var(--linha-forte); }

  /* Botão da agenda: verde (ação principal), não se confunde com os chips de emissora */
  .botao.agenda { gap: 6px; color: #fff; background: #238636; border-color: rgba(240,246,252,.1); font-weight: 600; }
  .botao.agenda:hover { background: #2ea043; border-color: rgba(240,246,252,.1); }
  .acoes .botao.agenda { margin-left: auto; }

  /* Selo "Ao vivo" */
  .aovivo { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 9999px; margin-left: 8px;
    font: 600 11px 'Inter', sans-serif; letter-spacing: .04em; text-transform: uppercase; color: #f85149;
    background: color-mix(in srgb, #f85149 15%, transparent); }
  .pulso { width: 7px; height: 7px; border-radius: 50%; background: #f85149; animation: pulso 1.6s ease-in-out infinite; }
  @keyframes pulso { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .pulso { animation: none; } }
  .jogo.vivo { box-shadow: inset 2px 0 0 #f85149; }
  .confronto .hr .aovivo { display: flex; margin: 3px 0 0; justify-content: center; }
  .confronto .hr .aovivo[hidden] { display: none; }

  /* Página de uma emissora */
  .em-topo { padding: 20px 0 0; }
  .em-topo .voltar { font-size: 14px; text-decoration: none; }
  .em-topo .voltar:hover { text-decoration: underline; }
  .em-topo .tipo { font-size: 12px; color: var(--suave); margin-top: 16px; }
  .em-topo h2 { font-size: 24px; font-weight: 600; letter-spacing: -.02em; line-height: 1.2; }
  .em-topo p { color: var(--suave); margin-top: 4px; }
  .em-topo p b { color: var(--texto); font-weight: 600; }
  .bloco-dia { margin-top: 24px; }
  .dia { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .grupo + .grupo { margin-top: 12px; }
  .grupo-topo { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--elevado); border-bottom: 1px solid var(--linha); }
  .grupo-topo b { font-size: 14px; font-weight: 600; }
  .grupo-topo small { font-size: 12px; color: var(--suave); }
  .linha { display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; align-items: center; padding: 12px 16px; }
  .linha + .linha { border-top: 1px solid var(--linha); }
  .linha:hover { background: var(--elevado); }
  .confronto { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; font-weight: 600; }
  .confronto .casa { text-align: right; }
  .confronto .hr { font-size: 14px; text-align: center; color: var(--texto); background: var(--fundo); border: 1px solid var(--linha);
    border-radius: 6px; padding: 2px 8px; }
  .confronto .hr small { display: block; font: 500 10px 'Inter', sans-serif; color: var(--suave); }
  .linha .lado { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
  .linha .canais { justify-content: flex-end; }
  @media (max-width: 560px) {
    .jogo { flex-direction: column; align-items: stretch; }
    .acoes { justify-content: space-between; }
    .linha { grid-template-columns: 1fr; }
    .linha .lado, .linha .canais { justify-content: center; }
  }
${partidas ? CSS_PARTIDAS : ''}</style>
</head><body>
${partidas ? `${cabecalho}
<section class="intro"><div class="wrap">
  <div class="so-no-dia">
    <h1>${titulo}</h1>
    <div class="data"><b>${esc(dia)}</b> · ${jogos.length} jogos · horários de Brasília</div>
  </div>
  ${filtros}
</div></section>` : `<header><div class="wrap">
  <div class="kicker">Agenda esportiva · <b>Jogos do Dia</b></div>
  <h1>${titulo}</h1>
  <div class="data"><b>${esc(dia)}</b> · ${jogos.length} jogos · horários de Brasília</div>
  <div class="dica">"Salvar na agenda" adiciona o jogo no Google Agenda. Ou <a href="agenda.ics">baixe todos (.ics)</a>.</div>
  ${filtros}
</div></header>
<div class="wrap">${seletor}</div>`}
<main class="wrap" id="dia">${cards || '<p class="vazio">Nenhum jogo com transmissão encontrado.</p>'}</main>
<main class="wrap" id="porEmissora" hidden></main>
${script(dados, dias)}
</body></html>
`;
}

// ---- Prévia "Partidas do Dia": cabeçalho com marca, busca e menus ----

const LUPA = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>';
const SETA = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.94l3.72-3.72a.749.749 0 0 1 1.06 0Z"/></svg>';
// Marca: bola com o "play" da transmissão
const LOGO = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="#3fb950" stroke-width="2.5"/>'
  + '<circle cx="17" cy="17" r="10" fill="none" stroke="#3fb950" stroke-width="1.5" stroke-dasharray="3 3" opacity=".55"/><path d="M14 11.5v11l9-5.5z" fill="currentColor"/></svg>';
const TIPOS = { tv: 'TV', stream: 'Streaming', yt: 'YouTube' };

function cabecalhoPartidas(dados, dias) {
  // Canais (por tipo) e campeonatos (por esporte), com quantos jogos têm nos próximos dias
  const canais = new Map();
  const camps = new Map();
  for (const j of dados) {
    for (const c of new Set(j.t)) {
      const nome = emissoraDoFiltro(c);
      const atual = canais.get(nome) || { n: 0, tipo: tipoCanal(c) };
      atual.n++;
      canais.set(nome, atual);
    }
    const chave = `${j.e}|${j.c}`;
    camps.set(chave, (camps.get(chave) || 0) + 1);
  }
  const colunasCanais = Object.entries(TIPOS).map(([tipo, titulo]) => {
    const itens = [...canais].filter(([, v]) => v.tipo === tipo).sort((a, b) => b[1].n - a[1].n);
    if (!itens.length) return '';
    return `<div class="coluna"><h4>${titulo}</h4>${itens.map(([nome, v]) =>
      `<a href="#canal/${slug(nome)}"><span class="marcador ${tipo}"></span>${esc(nome)}<small>${v.n}</small></a>`).join('')}</div>`;
  }).join('');
  const colunasCamps = Object.keys(ESPORTES).map((e) => {
    const itens = [...camps].filter(([k]) => k.startsWith(`${e}|`)).sort((a, b) => b[1] - a[1]);
    if (!itens.length) return '';
    return `<div class="coluna"><h4>${ESPORTES[e].icone} ${ESPORTES[e].nome}</h4>${itens.map(([k, n]) => {
      const nome = k.slice(e.length + 1);
      return `<a href="#campeonato/${slug(nome)}"><span class="marcador" style="background:${CORES[e]}"></span>${esc(nome)}<small>${n}</small></a>`;
    }).join('')}</div>`;
  }).join('');

  return `<header class="topo">
  <div class="wrap topo-linha">
    <a class="marca" href="#" aria-label="Partidas do Dia: início">${LOGO}<span>PARTIDAS <small>do</small> <em>DIA</em></span></a>
    <form class="busca" role="search">
      <input id="busca" type="search" placeholder="Buscar jogos, times, canais..." autocomplete="off" aria-label="Buscar jogos, times ou canais">
      <button type="submit" aria-label="Buscar">${LUPA}</button>
    </form>
  </div>
  <nav class="menu" aria-label="Principal"><div class="wrap menu-linha">
    <a class="item" data-menu="ao-vivo" href="#ao-vivo"><span class="pulso"></span>Ao vivo<span class="contador contador-vivo" hidden></span></a>
    <div class="item sub" data-menu="canal">
      <button type="button" aria-expanded="false" aria-haspopup="true">Canais ${SETA}</button>
      <div class="painel"><div class="painel-topo"><b>Canais</b><span>jogos nos próximos ${dias} dias</span></div>
        <div class="colunas">${colunasCanais}</div>
        <a class="ver-todos" href="/canais/">Ver todos os canais →</a></div>
    </div>
    <div class="item sub" data-menu="campeonato">
      <button type="button" aria-expanded="false" aria-haspopup="true">Campeonatos ${SETA}</button>
      <div class="painel largo"><div class="painel-topo"><b>Campeonatos</b><span>jogos nos próximos ${dias} dias</span></div>
        <div class="colunas">${colunasCamps}</div>
        <a class="ver-todos" href="/campeonatos/">Ver todos os campeonatos →</a></div>
    </div>
    <a class="item" data-menu="noticias" href="/noticias/">Notícias</a>
  </div></nav>
</header>`;
}

const CSS_PARTIDAS = `
  /* ---- Partidas do Dia: topo ---- */
  .topo { background: var(--card); border-bottom: 1px solid var(--linha); position: sticky; top: 0; z-index: 20; }
  .topo-linha { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 64px; }
  .marca { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--texto); flex: none; }
  .marca span { font-size: 17px; font-weight: 600; letter-spacing: .02em; white-space: nowrap; }
  .marca small { font-size: 11px; font-weight: 500; color: var(--suave); text-transform: uppercase; margin: 0 1px; }
  .marca em { font-style: normal; color: #3fb950; }
  .busca { display: flex; flex: 0 1 380px; min-width: 0; }
  .busca input { flex: 1; min-width: 0; height: 36px; font: inherit; font-size: 14px; color: var(--texto); background: var(--fundo);
    border: 1px solid var(--linha); border-right: 0; border-radius: 6px 0 0 6px; padding: 0 12px; }
  .busca input::placeholder { color: var(--apagado); }
  .busca input:focus { outline: 2px solid var(--primaria); outline-offset: -1px; }
  .busca button { width: 40px; height: 36px; display: grid; place-items: center; color: #fff; background: #238636;
    border: 1px solid rgba(240,246,252,.1); border-radius: 0 6px 6px 0; cursor: pointer; }
  .busca button:hover { background: #2ea043; }

  .menu { border-top: 1px solid var(--linha); }
  .menu-linha { display: flex; gap: 4px; height: 48px; align-items: stretch; }
  .menu .item { position: relative; display: flex; align-items: center; }
  .menu .item > a, .menu .item > button, a.item { display: flex; align-items: center; gap: 6px; height: 100%; padding: 0 12px; font: inherit;
    font-size: 14px; font-weight: 500; color: var(--suave); text-decoration: none; background: none; border: 0;
    border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: color .1s; }
  a.item:hover, .menu .item > button:hover, .sub.aberto > button { color: var(--texto); }
  a.item.ativo, .sub.ativo > button { color: var(--texto); font-weight: 600; border-bottom-color: var(--destaque); }
  .sub > button svg { transition: transform .1s; }
  .sub.aberto > button svg { transform: rotate(180deg); }
  .menu .pulso { width: 8px; height: 8px; }
  .contador { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px; font-size: 12px; font-weight: 600; line-height: 20px;
    text-align: center; color: #f85149; background: color-mix(in srgb, #f85149 15%, transparent); }

  .wrap { max-width: 1012px; }
  .painel { display: none; position: absolute; top: 100%; left: 0; width: 640px; max-height: min(70vh, 560px); overflow: auto;
    background: var(--elevado); border: 1px solid var(--linha); border-radius: 6px; padding: 12px; z-index: 30;
    box-shadow: 0 8px 24px rgba(1,4,9,.5); }
  .painel.largo { width: 760px; }
  .painel.largo .coluna:first-child { grid-column: span 2; column-count: 2; column-gap: 12px; } /* futebol: lista longa */
  .painel.largo .coluna:first-child h4 { column-span: all; }
  .coluna a { break-inside: avoid; }
  .sub.aberto .painel { display: block; }
  .painel-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 4px 8px;
    border-bottom: 1px solid var(--linha); margin-bottom: 8px; }
  .painel-topo b { font-size: 14px; font-weight: 600; }
  .painel-topo span { font-size: 12px; color: var(--suave); }
  .colunas { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px 12px; }
  .coluna h4 { font-size: 12px; font-weight: 600; color: var(--suave); padding: 6px 4px 4px; }
  .coluna a { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; font-size: 14px; color: var(--texto);
    text-decoration: none; }
  .coluna a:hover { background: var(--card); }
  .coluna a small { margin-left: auto; font-size: 12px; color: var(--suave); font-family: 'JetBrains Mono', monospace; }
  .marcador { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .marcador.tv { background: var(--tv); } .marcador.stream { background: var(--stream); } .marcador.yt { background: var(--yt); }
  .ver-todos { display: block; margin-top: 8px; padding: 8px 4px 0; border-top: 1px solid var(--linha); font-size: 14px; text-decoration: none; }
  .ver-todos:hover { text-decoration: underline; }
  .grupo-topo a { color: inherit; text-decoration: none; }
  .grupo-topo a:hover { text-decoration: underline; }

  .intro { border-bottom: 1px solid var(--linha); padding-top: 20px; }
  .intro .filtros { margin-top: 12px; }

  @media (max-width: 680px) {
    .topo { position: static; }
    .topo-linha { flex-wrap: wrap; height: auto; padding-top: 12px; padding-bottom: 12px; gap: 12px; }
    .busca { flex: 1 1 100%; }
    .menu-linha { overflow-x: auto; scrollbar-width: none; }
    .menu .item { position: static; }
    .painel.largo .coluna:first-child { grid-column: auto; column-count: 1; }
    .menu { position: relative; }
    .painel, .painel.largo { position: absolute; left: 8px; right: 8px; top: calc(100% + 4px); width: auto; max-height: 70vh; }
  }
`;

// Script da página: filtro por esporte e as "páginas" por endereço:
//   #ao-vivo · #canal/cazetv (ou o antigo #cazetv) · #campeonato/brasileirao-serie-a · #busca/flamengo
function script(dados, dias) {
  const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
  return String.raw`<script>
  const SEMANA = ${json(dados)};
  const ESPORTES = ${json(Object.fromEntries(Object.entries(ESPORTES).map(([k, v]) => [k, v.icone])))};
  const CORES = ${json(CORES)};
  const DURACAO = ${json(DURACAO)};
  const DIAS = ${dias};
  const CALENDARIO = ${json(CALENDARIO)};
  const AO_VIVO = ${json(AO_VIVO)};
  let esporte = '';

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const filtro = (c) => c.replace(/\s*\(.*\)\s*$/, '').trim() || c;
  const slug = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const normal = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tipo = (c) => /youtube|\byt\b|cazé|getv|ge tv/i.test(c) ? 'yt'
    : /disney|prime|max|globoplay|paramount|netflix|league pass|dazn|apple|star\+|onefootball|sportynet/i.test(c) ? 'stream' : 'tv';
  const hojeBR = (mais = 0) => new Date(Date.now() + mais * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const nomeDia = (d, o) => { const s = new Date(d + 'T12:00:00-03:00').toLocaleDateString('pt-BR', o); return s.charAt(0).toUpperCase() + s.slice(1); };
  const rotulo = (d) => d === hojeBR() ? 'Hoje' : d === hojeBR(1) ? 'Amanhã' : nomeDia(d, { weekday: 'long', day: '2-digit', month: '2-digit' });
  const CANAIS = {}; // slug → nome da emissora
  const CAMPEONATOS = {}; // slug → nome do campeonato
  for (const j of SEMANA) {
    for (const c of j.t) CANAIS[slug(filtro(c))] = filtro(c);
    CAMPEONATOS[slug(j.c)] = j.c;
  }
  const inicio = (j) => Date.parse(j.d + 'T' + j.h.replace('h', ':') + ':00-03:00');
  const aoVivo = (j, agora) => agora >= inicio(j) && agora < inicio(j) + DURACAO[j.e] * 60000;

  function linkAgenda(j) {
    const [h, m] = j.h.split('h').map(Number);
    const ini = new Date(j.d + 'T00:00:00Z'); ini.setUTCHours(h, m || 0);
    const fim = new Date(ini.getTime() + DURACAO[j.e] * 60000);
    const fmt = (x) => x.toISOString().replace(/[-:]/g, '').slice(0, 15);
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: ESPORTES[j.e] + ' ' + j.m + ' x ' + j.v,
      dates: fmt(ini) + '/' + fmt(fim), ctz: 'America/Sao_Paulo', details: j.c + (j.r ? ' · ' + j.r : '') + '\nOnde assistir: ' + j.t.join(', '), location: j.t.join(', ') });
  }

  // Lista de jogos de vários dias: por dia e, dentro do dia, por campeonato
  function lista(jogos, canalEscolhido) {
    let html = '';
    for (const dia of [...new Set(jogos.map((j) => j.a))]) {
      html += '<section class="bloco-dia"><h3 class="dia">' + esc(rotulo(dia)) + '</h3>';
      const grupos = new Map();
      for (const j of jogos.filter((x) => x.a === dia)) {
        const chave = j.e + '|' + j.c;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(j);
      }
      for (const doGrupo of grupos.values()) {
        const p = doGrupo[0];
        html += '<div class="grupo" style="--cor:' + CORES[p.e] + '"><div class="grupo-topo"><span class="ponto"></span>'
          + '<a href="#campeonato/' + slug(p.c) + '"><b>' + esc(p.c) + '</b></a>' + (p.r ? '<small>' + esc(p.r) + '</small>' : '') + '</div>';
        for (const j of doGrupo) {
          const madrugada = j.d !== j.a ? '<small>madrugada</small>' : '';
          html += '<div class="linha jogo" data-esporte="' + j.e + '" data-inicio="' + j.d + 'T' + j.h.replace('h', ':') + ':00-03:00" data-duracao="' + DURACAO[j.e] + '">'
            + '<div class="confronto"><span class="casa">' + esc(j.m) + '</span>'
            + '<time class="hr">' + esc(j.h) + madrugada + AO_VIVO + '</time><span class="fora">' + esc(j.v) + '</span></div>'
            + '<div class="lado"><div class="canais">' + j.t.map((c) => '<a class="chip ' + tipo(c) + (filtro(c) === canalEscolhido ? ' sel' : '')
              + '" href="#canal/' + slug(filtro(c)) + '">' + esc(c) + '</a>').join('') + '</div>'
            + '<a class="botao agenda" href="' + esc(linkAgenda(j)) + '" target="_blank" rel="noopener" title="Salvar na agenda">' + CALENDARIO + 'Agenda</a></div></div>';
        }
        html += '</div>';
      }
      html += '</section>';
    }
    return html || '<p class="vazio">Nenhum jogo encontrado.</p>';
  }

  const topo = (tipoTxt, titulo, sub) => '<section class="em-topo"><a class="voltar" href="#">← Agenda do dia</a><div class="tipo">' + tipoTxt
    + '</div><h2>' + titulo + '</h2><p>' + sub + '</p></section>';
  const qtd = (n) => '<b>' + n + '</b> ' + (n === 1 ? 'jogo' : 'jogos');
  const proximos = ' nos próximos ' + DIAS + ' dias · horários de Brasília';

  // O que mostrar pro endereço atual (null = agenda do dia)
  function rota() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [tipoRota, ...resto] = h.split('/');
    const valor = resto.join('/');
    if (h === 'ao-vivo') {
      const agora = Date.now();
      const l = SEMANA.filter((j) => aoVivo(j, agora));
      return { menu: 'ao-vivo', titulo: 'Ao vivo agora', html: topo('Ao vivo', 'Ao vivo agora',
        l.length ? qtd(l.length) + ' acontecendo agora' : 'Nenhum jogo da agenda está rolando agora.') + (l.length ? lista(l) : '') };
    }
    if (tipoRota === 'campeonato' && CAMPEONATOS[valor]) {
      const nome = CAMPEONATOS[valor];
      const l = SEMANA.filter((j) => j.c === nome);
      return { menu: 'campeonato', titulo: nome, html: topo('Campeonato', esc(nome), qtd(l.length) + proximos) + lista(l) };
    }
    if (tipoRota === 'busca' && valor.trim()) {
      const termo = normal(valor.trim());
      const l = SEMANA.filter((j) => normal([j.m, j.v, j.c].concat(j.t).join(' ')).includes(termo));
      return { menu: 'busca', titulo: 'Busca: ' + valor, html: topo('Busca', 'Resultados para “' + esc(valor.trim()) + '”', qtd(l.length) + proximos) + lista(l) };
    }
    const canal = CANAIS[tipoRota === 'canal' ? valor : h];
    if (canal) {
      const l = SEMANA.filter((j) => j.t.some((c) => filtro(c) === canal));
      return { menu: 'canal', canal: tipoRota === 'canal' ? valor : h, titulo: 'Jogos na ' + canal,
        html: topo('Canal · Brasil', 'Jogos na ' + esc(canal), qtd(l.length) + ' na <b>' + esc(canal) + '</b>' + proximos) + lista(l, canal) };
    }
    return null;
  }

  // Esconde os jogos de outros esportes e os horários, campeonatos e dias que ficaram vazios
  function aplicarEsporte() {
    document.querySelectorAll('.jogo').forEach((j) => { j.hidden = esporte && j.dataset.esporte !== esporte; });
    document.querySelectorAll('.bloco, .grupo, .bloco-dia').forEach((b) => { b.hidden = !b.querySelector('.jogo:not([hidden])'); });
  }

  // "Ao vivo" entre o início e o fim estimado (duração média do esporte); depois some
  function marcarAoVivo() {
    const agora = Date.now();
    document.querySelectorAll('[data-inicio]').forEach((el) => {
      const ini = Date.parse(el.dataset.inicio);
      const vivo = agora >= ini && agora < ini + Number(el.dataset.duracao) * 60000;
      el.classList.toggle('vivo', vivo);
      const selo = el.querySelector('.aovivo');
      if (selo) selo.hidden = !vivo;
    });
    const n = SEMANA.filter((j) => aoVivo(j, agora)).length;
    document.querySelectorAll('.contador-vivo').forEach((el) => { el.textContent = n; el.hidden = !n; });
  }

  const seletor = document.getElementById('emissora');
  const busca = document.getElementById('busca');
  const tituloOriginal = document.title;
  let ultimaRota = null;
  function mostrar() {
    const r = rota();
    const caixa = document.getElementById('porEmissora');
    document.getElementById('dia').hidden = !!r;
    document.querySelectorAll('.so-no-dia').forEach((el) => { el.hidden = !!r; });
    caixa.hidden = !r;
    if (seletor) seletor.value = r && r.menu === 'canal' ? r.canal : '';
    if (busca && !(r && r.menu === 'busca')) busca.value = '';
    document.querySelectorAll('[data-menu]').forEach((el) => el.classList.toggle('ativo', !!r && el.dataset.menu === r.menu));
    if (r) {
      caixa.innerHTML = r.html;
      document.title = r.titulo + ' · ' + tituloOriginal.split(':')[0];
      if (location.hash !== ultimaRota && r.menu !== 'busca') window.scrollTo(0, 0);
    } else {
      document.title = tituloOriginal;
    }
    ultimaRota = location.hash;
    fecharMenus();
    aplicarEsporte();
    marcarAoVivo();
  }
  setInterval(() => { if (location.hash === '#ao-vivo') mostrar(); else marcarAoVivo(); }, 30000);

  // Submenus do topo: abre no clique (e no hover, no computador); fecha no Esc ou clicando fora
  function fecharMenus(exceto) {
    document.querySelectorAll('.sub.aberto').forEach((m) => { if (m !== exceto) { m.classList.remove('aberto'); m.querySelector('button').setAttribute('aria-expanded', 'false'); } });
  }
  document.querySelectorAll('.sub > button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const m = b.parentElement;
    fecharMenus(m);
    b.setAttribute('aria-expanded', String(m.classList.toggle('aberto')));
  }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.sub .painel')) fecharMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenus(); });

  // Busca: resultados enquanto digita (a partir de 2 letras), sem encher o histórico
  if (busca) {
    let espera;
    const buscar = () => {
      const t = busca.value.trim();
      if (t.length >= 2) location.replace('#busca/' + encodeURIComponent(t));
      else if (location.hash.startsWith('#busca/')) location.replace('#');
    };
    busca.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscar, 250); });
    busca.form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(espera); buscar(); busca.blur(); });
    const r = decodeURIComponent(location.hash.slice(1));
    if (r.startsWith('busca/')) busca.value = r.slice(6);
  }

  document.querySelectorAll('.filtros button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filtros button').forEach((x) => x.classList.toggle('ativo', x === b));
    esporte = b.dataset.esporte;
    aplicarEsporte();
  }));
  if (seletor) seletor.addEventListener('change', () => { location.hash = seletor.value ? 'canal/' + seletor.value : ''; if (!seletor.value) mostrar(); });
  window.addEventListener('hashchange', mostrar);
  mostrar();
</script>`;
}
