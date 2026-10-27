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

// Jogos de madrugada (ex.: NBA 00h00) vão pro fim da lista do dia.
function ordem(horario) {
  const [h, m] = horario.split('h').map(Number);
  return (h < 6 ? h + 24 : h) * 60 + (m || 0);
}

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

// Busca todos os esportes pedidos e junta numa lista só, em ordem de horário.
// Se um esporte falhar, segue com os outros.
export async function buscarTodos(esportes = Object.keys(ESPORTES), data = chaveData()) {
  const resultados = await Promise.allSettled(esportes.map((e) => buscarJogos(e, data)));
  const jogos = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') jogos.push(...r.value);
    else console.error(`Falha ao buscar ${esportes[i]}:`, r.reason.message);
  });
  if (resultados.every((r) => r.status === 'rejected')) throw new Error('Não consegui acessar o futnatv.');
  return jogos.sort((x, y) => ordem(x.horario) - ordem(y.horario));
}
