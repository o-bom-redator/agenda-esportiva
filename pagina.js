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
      <article class="jogo" data-esporte="${j.esporte}" style="--cor:${CORES[j.esporte]}">
        <div class="info">
          <div class="camp"><span class="ponto"></span>${esc(j.campeonato)}${j.rodada ? ` <span>· ${esc(j.rodada)}</span>` : ''}</div>
          <div class="times">${esc(j.mandante)} <span class="x">×</span> ${esc(j.visitante)}</div>
        </div>
        <div class="acoes">
          <div class="canais">${chipsComLink(j.transmissao)}</div>
          <a class="botao" href="${esc(linkGoogleAgenda(j, data))}" target="_blank" rel="noopener">Salvar na agenda</a>
        </div>
      </article>`).join('')}
    </div></section>`;
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
</style>
</head><body>
<header><div class="wrap">
  <div class="kicker">Agenda esportiva · <b>Jogos do Dia</b></div>
  <h1>${titulo}</h1>
  <div class="data"><b>${esc(dia)}</b> · ${jogos.length} jogos · horários de Brasília</div>
  <div class="dica">"Salvar na agenda" adiciona o jogo no Google Agenda. Ou <a href="agenda.ics">baixe todos (.ics)</a>.</div>
  ${filtros}
</div></header>
<div class="wrap">${seletor}</div>
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
      html += '<section class="bloco-dia"><h3 class="dia">' + esc(rotulo(dia)) + '</h3>';
      const grupos = new Map();
      for (const j of lista.filter((x) => x.a === dia)) {
        const chave = j.e + '|' + j.c;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(j);
      }
      for (const jogos of grupos.values()) {
        const p = jogos[0];
        html += '<div class="grupo" style="--cor:' + CORES[p.e] + '"><div class="grupo-topo"><span class="ponto"></span><b>'
          + esc(p.c) + '</b>' + (p.r ? '<small>' + esc(p.r) + '</small>' : '') + '</div>';
        for (const j of jogos) {
          const madrugada = j.d !== j.a ? '<small>madrugada</small>' : '';
          html += '<div class="linha jogo" data-esporte="' + j.e + '"><div class="confronto"><span class="casa">' + esc(j.m) + '</span>'
            + '<time class="hr">' + esc(j.h) + madrugada + '</time><span class="fora">' + esc(j.v) + '</span></div>'
            + '<div class="lado"><div class="canais">' + j.t.map((c) => '<a class="chip ' + tipo(c) + (filtro(c) === nome ? ' sel' : '')
              + '" href="#' + slug(filtro(c)) + '">' + esc(c) + '</a>').join('') + '</div>'
            + '<a class="botao" href="' + esc(linkAgenda(j)) + '" target="_blank" rel="noopener" title="Salvar na agenda">Agenda</a></div></div>';
        }
        html += '</div>';
      }
      html += '</section>';
    }
    return html;
  }

  // Esconde os jogos de outros esportes e os horários, campeonatos e dias que ficaram vazios
  function aplicarEsporte() {
    document.querySelectorAll('.jogo').forEach((j) => { j.hidden = esporte && j.dataset.esporte !== esporte; });
    document.querySelectorAll('.bloco, .grupo, .bloco-dia').forEach((b) => { b.hidden = !b.querySelector('.jogo:not([hidden])'); });
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
