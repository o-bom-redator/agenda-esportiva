// Busca os jogos na API do futnatv (a mesma que o site usa pra trocar de dia) e completa o
// futebol com o feed do oGol (ogol.js): se uma fonte cair, a outra segura.
import { separarCanais } from './imagem.js';
import { padronizar } from './emissoras.js';
import { buscarOgol } from './ogol.js';
import { acharJogo } from './times.js';

export const ESPORTES = {
  futebol: { nome: 'Futebol', icone: '⚽' },
  basquete: { nome: 'Basquete', icone: '🏀' },
  volei: { nome: 'Vôlei', icone: '🏐' },
  nfl: { nome: 'NFL', icone: '🏈' },
};

// Data no formato AAAA-MM-DD, no fuso de Brasília. diasAFrente = 1 é amanhã.
export function chaveData(diasAFrente = 0) {
  const d = new Date(Date.now() + diasAFrente * 86_400_000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

// '2026-10-28' → '2026-10-29'
export function diaSeguinte(data) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// A agenda de um dia vai das 6h até as 5h59 da madrugada seguinte (como numa grade de TV).
// O futnatv lista cada jogo no dia em que ele realmente acontece: o NBA 00h00 do dia 28
// é a madrugada de 27 pra 28. Então pegamos os jogos do dia a partir das 6h e os da madrugada
// do dia seguinte, que ficam no fim da lista com a data marcada (campo `data`).
export const VIRADA = 6;
const hora = (horario) => Number(horario.split('h')[0]);

// Busca os jogos de um esporte numa data. Guarda o resultado (a agenda da semana pede o mesmo dia duas vezes).
const pedidos = new Map();
export function buscarJogos(esporte, data) {
  const chave = `${esporte} ${data}`;
  if (!pedidos.has(chave)) pedidos.set(chave, buscarNoFutnatv(esporte, data).catch((e) => { pedidos.delete(chave); throw e; }));
  return pedidos.get(chave);
}

async function buscarNoFutnatv(esporte, data) {
  const res = await fetch(`https://futnatv.net/api/${esporte}?data=${data}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36' },
  });
  if (!res.ok) throw new Error(`futnatv (${esporte}) respondeu ${res.status}`);
  const { schedule = [] } = await res.json();
  const dia = schedule.find((d) => d.key === data);

  const vistos = new Set();
  return (dia?.games || [])
    .filter((g) => String(g.broadcast || '').trim()) // o site só mostra jogos com transmissão
    .map((g) => ({
      esporte,
      data, // dia real do jogo
      horario: g.time,
      campeonato: g.competition || '',
      rodada: g.round || '',
      mandante: g.home || '',
      visitante: g.away || '',
      transmissao: g.broadcast.replace(/<>\s*(e\s+)?/g, '').replace(/\s+/g, ' ').trim(),
      encerrado: false,
    }))
    .filter((j) => {
      const chave = `${j.horario}|${j.mandante}|${j.visitante}|${j.campeonato}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}

const minutos = (horario) => { const [h, m] = horario.split('h').map(Number); return h * 60 + (m || 0); };

// Junta os jogos do oGol: o mesmo jogo (horário até 30 min diferente e times parecidos) ganha a
// emissora que faltava; jogo que o futnatv não tem entra na lista.
function juntarOgol(jogos, doOgol) {
  for (const o of doOgol) {
    const candidatos = jogos.filter((j) => j.esporte === 'futebol' && j.data === o.data && Math.abs(minutos(j.horario) - minutos(o.horario)) <= 30);
    const igual = acharJogo(o, candidatos);
    if (igual) {
      if (!separarCanais(igual.transmissao).map(padronizar).includes(padronizar(o.transmissao))) igual.transmissao += `, ${o.transmissao}`;
    } else {
      jogos.push({ ...o, campeonato: o.campeonato || 'Futebol' });
    }
  }
}

// Busca todos os esportes pedidos e junta numa lista só, em ordem de horário
// (do dia, a partir das 6h, até a madrugada seguinte). Se uma fonte falhar, segue com as outras.
export async function buscarTodos(esportes = Object.keys(ESPORTES), data = chaveData()) {
  const amanha = diaSeguinte(data);
  const lista = esportes.flatMap((e) => [[e, data], [e, amanha]]);
  const [ogol, ...resultados] = await Promise.allSettled([
    esportes.includes('futebol') ? buscarOgol() : Promise.resolve([]),
    ...lista.map(([e, d]) => buscarJogos(e, d)),
  ]);
  const jogos = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') jogos.push(...r.value.map((j) => ({ ...j })));
    else console.error(`Falha ao buscar ${lista[i].join(' ')}:`, r.reason.message);
  });
  if (ogol.status === 'rejected') console.error('Falha ao buscar o oGol:', ogol.reason.message);
  if (resultados.every((r) => r.status === 'rejected') && !ogol.value?.length) throw new Error('Não consegui acessar o futnatv nem o oGol.');
  const naJanela = (j) => (j.data === data ? hora(j.horario) >= VIRADA : j.data === amanha && hora(j.horario) < VIRADA);
  juntarOgol(jogos, (ogol.value || []).filter(naJanela));
  return jogos
    .filter(naJanela)
    .map((j) => ({ ...j, transmissao: [...new Set(separarCanais(j.transmissao).map(padronizar))].join(', ') }))
    .sort((x, y) => `${x.data} ${x.horario}`.localeCompare(`${y.data} ${y.horario}`));
}

// Agenda de vários dias (pro filtro por emissora do site): [{ data, jogos }]
export async function buscarDias(esportes, data, dias = 7) {
  const datas = [data];
  while (datas.length < dias) datas.push(diaSeguinte(datas.at(-1)));
  const res = await Promise.allSettled(datas.map((d) => buscarTodos(esportes, d)));
  if (res[0].status === 'rejected') throw res[0].reason; // o dia principal é obrigatório; os outros são extra
  return datas.map((d, i) => ({ data: d, jogos: res[i].status === 'fulfilled' ? res[i].value : [] }));
}
