// Busca os jogos na API do futnatv (a mesma que o site usa pra trocar de dia).
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

// Busca os jogos de um esporte numa data.
export async function buscarJogos(esporte, data) {
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

// Busca todos os esportes pedidos e junta numa lista só, em ordem de horário
// (do dia, a partir das 6h, até a madrugada seguinte). Se um esporte falhar, segue com os outros.
export async function buscarTodos(esportes = Object.keys(ESPORTES), data = chaveData()) {
  const amanha = diaSeguinte(data);
  const pedidos = esportes.flatMap((e) => [[e, data], [e, amanha]]);
  const resultados = await Promise.allSettled(pedidos.map(([e, d]) => buscarJogos(e, d)));
  const jogos = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') jogos.push(...r.value);
    else console.error(`Falha ao buscar ${pedidos[i].join(' ')}:`, r.reason.message);
  });
  if (resultados.every((r) => r.status === 'rejected')) throw new Error('Não consegui acessar o futnatv.');
  return jogos
    .filter((j) => (j.data === data ? hora(j.horario) >= VIRADA : hora(j.horario) < VIRADA))
    .sort((x, y) => `${x.data} ${x.horario}`.localeCompare(`${y.data} ${y.horario}`));
}
