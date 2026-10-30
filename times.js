// Cruzar nomes de times de fontes diferentes (futnatv em português, Reddit em inglês, oGol...)
const APELIDOS = {
  'inter milan': 'internazionale', inter: 'internazionale', psg: 'paris saint germain', 'paris sg': 'paris saint germain',
  'man city': 'manchester city', 'man utd': 'manchester united', 'man united': 'manchester united',
  spurs: 'tottenham', wolves: 'wolverhampton', 'nottm forest': 'nottingham forest',
};
// Siglas e palavras que não ajudam a identificar o time (FC, SSC, VfB, "1. FC", "Bayer 04"...)
const VAZIAS = new Set(['fc', 'cf', 'ac', 'sc', 'afc', 'cd', 'ud', 'sd', 'ssc', 'vfl', 'vfb', 'tsg', 'sv', 'ssv', 'sg', 'bsc', 'us', 'as',
  'calcio', 'de', 'da', 'do', 'del', 'la', 'the', 'club', 'f', 'w', 'women', 'feminino', '1', '04', '05']);

const normalizar = (nome) => {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return (APELIDOS[n] || n).split(' ').filter((p) => p && !VAZIAS.has(p));
};
// Palavras "iguais": idênticas ou com o mesmo começo (munich/munique, milan/milao)
const parecidas = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
export function semelhanca(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x.length || !y.length) return 0;
  const comuns = x.filter((p) => y.some((q) => parecidas(p, q))).length;
  return comuns / Math.min(x.length, y.length);
}

export function acharJogo(lance, jogos) {
  let melhor = null, nota = 0;
  for (const j of jogos) {
    const n = semelhanca(lance.mandante, j.mandante) + semelhanca(lance.visitante, j.visitante);
    if (n > nota) [melhor, nota] = [j, n];
  }
  return nota >= 1 ? melhor : null; // pelo menos um time bate inteiro (ou os dois em parte)
}
