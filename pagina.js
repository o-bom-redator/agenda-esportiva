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
  return canais.map((c) => `<a class="chip ${tipoCanal(c)}" href="#${slug(emissoraDoFiltro(c))}">${esc(c)}</a>`).join('');
}

// Jogos dos próximos dias, enxutos, pro filtro por emissora (o navegador monta os cards)
function dadosDaSemana(semana) {
  return semana.flatMap(({ data, jogos }) => jogos.map((j) => ({
    a: data, d: j.data, h: j.horario, e: j.esporte, c: j.campeonato, r: j.rodada, m: j.mandante, v: j.visitante,
    t: separarCanais(j.transmissao),
  })));
}

export function gerarPagina(jogos, data, semana = [{ data, jogos }]) {
  const dia = formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' });
  const titulo = ehHoje(data) ? 'Jogos de hoje' : 'Jogos do dia';
  const esportesPresentes = Object.keys(ESPORTES).filter((e) => jogos.some((j) => j.esporte === e));

  const filtros = esportesPresentes.length > 1
    ? `<nav class="filtros"><button class="ativo" data-esporte="">Todos</button>${esportesPresentes
      .map((e) => `<button data-esporte="${e}" style="--cor:${CORES[e]}">${ESPORTES[e].icone} ${ESPORTES[e].nome}</button>`).join('')}</nav>`
    : '';

  const dados = dadosDaSemana(semana);
  const contagem = new Map();
  for (const j of dados) for (const e of new Set(j.t.map(emissoraDoFiltro))) contagem.set(e, (contagem.get(e) || 0) + 1);
  const emissoras = [...contagem].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  const dias = semana.length;
  const seletor = `<div class="emissora"><label for="emissora">📺 Onde assistir</label><select id="emissora">
    <option value="">Todas as emissoras (${ehHoje(data) ? 'hoje' : 'este dia'})</option>${emissoras
    .map(([e, n]) => `<option value="${slug(e)}">${esc(e)} (${n})</option>`).join('')}</select>
    <span>jogos de uma emissora nos próximos ${dias} dias</span></div>`;

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
        <div class="canais">${chipsComLink(j.transmissao)}</div>
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
  .emissora { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 16px 0; max-width: 720px; margin: 0 auto; font-size: 14px; font-weight: 700; }
  .emissora select { font: inherit; font-size: 15px; font-weight: 700; color: var(--texto); background: var(--card); border: 1px solid var(--linha);
    border-radius: 10px; padding: 7px 10px; max-width: 100%; }
  .emissora span { font-weight: 500; color: var(--suave); font-size: 13px; }
  a.chip { text-decoration: none; }
  a.chip:hover { filter: brightness(.95); text-decoration: underline; }
  .chip.sel { outline: 2px solid currentColor; outline-offset: -2px; }
  /* Página de uma emissora */
  .em-topo { padding: 18px 0 4px; }
  .em-topo .voltar { font-size: 14px; font-weight: 700; color: #1a73e8; text-decoration: none; }
  .em-topo .tipo { font-size: 12px; letter-spacing: 1.5px; font-weight: 700; color: var(--suave); text-transform: uppercase; margin-top: 14px; }
  .em-topo h2 { font-size: 28px; font-weight: 900; letter-spacing: -.5px; line-height: 1.15; margin-top: 2px; }
  .em-topo p { font-size: 15px; color: var(--suave); margin-top: 6px; }
  .em-topo p b { color: var(--texto); }
  .dia { font-size: 19px; font-weight: 900; margin: 24px 0 8px; }
  .grupo { background: var(--card); border: 1px solid var(--linha); border-radius: 14px; margin-bottom: 10px; overflow: hidden;
    box-shadow: 0 1px 2px rgba(16,24,40,.06); }
  .grupo-topo { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-left: 5px solid var(--cor); }
  .grupo-topo .icone { font-size: 20px; }
  .grupo-topo b { display: block; font-size: 15px; font-weight: 800; }
  .grupo-topo small { display: block; font-size: 12.5px; color: var(--suave); font-weight: 500; }
  .grupo .jogo { border-left: 0; border-radius: 0; margin: 0; box-shadow: none; background: none; }
  .linha { display: grid; grid-template-columns: 1fr auto; gap: 8px 14px; align-items: center; padding: 12px 14px; border-top: 1px solid var(--linha); }
  .confronto { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; font-weight: 700; font-size: 15px; }
  .confronto .casa { text-align: right; }
  .confronto .hr { font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; text-align: center; }
  .confronto .hr small { display: block; font-size: 10.5px; font-weight: 700; color: var(--suave); text-transform: uppercase; letter-spacing: .5px; }
  .linha .lado { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
  .linha .canais { justify-content: flex-end; }
  .linha .agendar { text-decoration: none; font-size: 18px; line-height: 1; padding: 6px; border-radius: 8px; background: var(--fundo); }
  @media (max-width: 560px) {
    .linha { grid-template-columns: 1fr; }
    .linha .lado { justify-content: center; }
    .linha .canais { justify-content: center; }
  }
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
${seletor}
<main class="wrap" id="dia">${cards || '<p class="vazio">Nenhum jogo com transmissão encontrado.</p>'}</main>
<main class="wrap" id="porEmissora" hidden></main>
${script(dados, dias)}
</body></html>
`;
}

// Script da página: filtro por esporte e a "página" de cada emissora (endereço .../#cazetv)
function script(dados, dias) {
  const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
  return String.raw`<script>
  const SEMANA = ${json(dados)};
  const ESPORTES = ${json(Object.fromEntries(Object.entries(ESPORTES).map(([k, v]) => [k, v.icone])))};
  const CORES = ${json(CORES)};
  const DURACAO = ${json(DURACAO)};
  const DIAS = ${dias};
  let esporte = '';

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const filtro = (c) => c.replace(/\s*\(.*\)\s*$/, '').trim() || c;
  const slug = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tipo = (c) => /youtube|\byt\b|cazé|getv|ge tv/i.test(c) ? 'yt'
    : /disney|prime|max|globoplay|paramount|netflix|league pass|dazn|apple|star\+|onefootball|sportynet/i.test(c) ? 'stream' : 'tv';
  const hojeBR = (mais = 0) => new Date(Date.now() + mais * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const nomeDia = (d, o) => { const s = new Date(d + 'T12:00:00-03:00').toLocaleDateString('pt-BR', o); return s.charAt(0).toUpperCase() + s.slice(1); };
  const rotulo = (d) => d === hojeBR() ? 'Hoje' : d === hojeBR(1) ? 'Amanhã' : nomeDia(d, { weekday: 'long', day: '2-digit', month: '2-digit' });
  const NOMES = {}; // slug → nome da emissora
  for (const j of SEMANA) for (const c of j.t) NOMES[slug(filtro(c))] = filtro(c);

  function linkAgenda(j) {
    const [h, m] = j.h.split('h').map(Number);
    const ini = new Date(j.d + 'T00:00:00Z'); ini.setUTCHours(h, m || 0);
    const fim = new Date(ini.getTime() + DURACAO[j.e] * 60000);
    const fmt = (x) => x.toISOString().replace(/[-:]/g, '').slice(0, 15);
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: ESPORTES[j.e] + ' ' + j.m + ' x ' + j.v,
      dates: fmt(ini) + '/' + fmt(fim), ctz: 'America/Sao_Paulo', details: j.c + (j.r ? ' · ' + j.r : '') + '\nOnde assistir: ' + j.t.join(', '), location: j.t.join(', ') });
  }

  // Jogos da emissora nos próximos dias: por dia, e dentro do dia por campeonato
  function paginaDaEmissora(nome) {
    const lista = SEMANA.filter((j) => j.t.some((c) => filtro(c) === nome));
    let html = '<section class="em-topo"><a class="voltar" href="#">← Agenda do dia</a><div class="tipo">Emissora · Brasil</div>'
      + '<h2>Jogos na ' + esc(nome) + '</h2><p><b>' + lista.length + '</b> ' + (lista.length === 1 ? 'jogo' : 'jogos') + ' na <b>' + esc(nome)
      + '</b> nos próximos ' + DIAS + ' dias · horários de Brasília</p></section>';
    if (!lista.length) return html + '<p class="vazio">Nenhum jogo dessa emissora nos próximos dias.</p>';
    const dias = [...new Set(lista.map((j) => j.a))];
    for (const dia of dias) {
      html += '<h3 class="dia">' + esc(rotulo(dia)) + '</h3>';
      const grupos = new Map();
      for (const j of lista.filter((x) => x.a === dia)) {
        const chave = j.e + '|' + j.c;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(j);
      }
      for (const jogos of grupos.values()) {
        const p = jogos[0];
        html += '<div class="grupo" style="--cor:' + CORES[p.e] + '"><div class="grupo-topo"><span class="icone">' + ESPORTES[p.e] + '</span><div><b>'
          + esc(p.c) + '</b>' + (p.r ? '<small>' + esc(p.r) + '</small>' : '') + '</div></div>';
        for (const j of jogos) {
          const madrugada = j.d !== j.a ? '<small>madrugada</small>' : '';
          html += '<div class="linha jogo" data-esporte="' + j.e + '"><div class="confronto"><span class="casa">' + esc(j.m) + '</span>'
            + '<span class="hr">' + esc(j.h) + madrugada + '</span><span class="fora">' + esc(j.v) + '</span></div>'
            + '<div class="lado"><div class="canais">' + j.t.map((c) => '<a class="chip ' + tipo(c) + (filtro(c) === nome ? ' sel' : '')
              + '" href="#' + slug(filtro(c)) + '">' + esc(c) + '</a>').join('') + '</div>'
            + '<a class="agendar" href="' + esc(linkAgenda(j)) + '" target="_blank" rel="noopener" title="Salvar na agenda">📅</a></div></div>';
        }
        html += '</div>';
      }
    }
    return html;
  }

  // Esconde os jogos de outros esportes e os horários, campeonatos e dias que ficaram vazios
  function aplicarEsporte() {
    document.querySelectorAll('.jogo').forEach((j) => { j.hidden = esporte && j.dataset.esporte !== esporte; });
    document.querySelectorAll('.hora').forEach((h) => {
      let el = h.nextElementSibling, algum = false;
      while (el && el.classList.contains('jogo')) { if (!el.hidden) algum = true; el = el.nextElementSibling; }
      h.hidden = !algum;
    });
    document.querySelectorAll('.grupo').forEach((g) => { g.hidden = !g.querySelector('.jogo:not([hidden])'); });
    document.querySelectorAll('.dia').forEach((d) => {
      let el = d.nextElementSibling, algum = false;
      while (el && el.classList.contains('grupo')) { if (!el.hidden) algum = true; el = el.nextElementSibling; }
      d.hidden = !algum;
    });
  }

  const seletor = document.getElementById('emissora');
  function mostrar() {
    const s = decodeURIComponent(location.hash.slice(1));
    const nome = NOMES[s];
    const caixa = document.getElementById('porEmissora');
    document.getElementById('dia').hidden = !!nome;
    caixa.hidden = !nome;
    seletor.value = nome ? s : '';
    if (nome) {
      caixa.innerHTML = paginaDaEmissora(nome);
      document.title = 'Jogos na ' + nome + ' · Agenda esportiva';
      caixa.scrollIntoView({ block: 'start' });
    }
    aplicarEsporte();
  }

  document.querySelectorAll('.filtros button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filtros button').forEach((x) => x.classList.toggle('ativo', x === b));
    esporte = b.dataset.esporte;
    aplicarEsporte();
  }));
  seletor.addEventListener('change', () => { location.hash = seletor.value; if (!seletor.value) mostrar(); });
  window.addEventListener('hashchange', mostrar);
  mostrar();
</script>`;
}
