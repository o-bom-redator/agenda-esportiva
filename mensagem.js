import { ESPORTES } from './scraper.js';

// Categorias de base: sub-20, sub17, U19, juniores, youth, Primavera etc.
// Olha o campeonato e os nomes dos times (ex.: "Flamengo Sub-20").
const BASE = /\b(sub|u)[\s-]?\d{2}\b|junior|júnior|juniores|juvenil|youth|primavera|aspirantes|next gen|\bbase\b/i;
const ehBase = (j) => BASE.test(`${j.campeonato} ${j.rodada} ${j.mandante} ${j.visitante}`);

// Aplica os filtros do config.json (jogos encerrados sempre saem).
export function filtrarJogos(jogos, config = {}) {
  let lista = jogos.filter((j) => !j.encerrado);

  const ocultar = (config.ocultarCampeonatos || []).map((c) => c.toLowerCase());
  if (ocultar.length) lista = lista.filter((j) => !ocultar.some((c) => j.campeonato.toLowerCase().includes(c)));
  if (config.ocultarBase) lista = lista.filter((j) => !ehBase(j));
  if (config.ocultarFemininos) lista = lista.filter((j) => !/femin/i.test(j.campeonato));
  return lista;
}

// data = 'AAAA-MM-DD' → "Quarta-feira, 28/10"
export function formatarData(data, opcoes = { weekday: 'long', day: '2-digit', month: '2-digit' }) {
  const d = new Date(`${data}T12:00:00-03:00`).toLocaleDateString('pt-BR', { ...opcoes, timeZone: 'America/Sao_Paulo' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

// Jogo da madrugada seguinte: "qui, 29/10". Jogo do próprio dia: ''.
export function rotuloDia(jogo, data) {
  if (jogo.data === data) return '';
  return formatarData(jogo.data, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '').toLowerCase();
}

// "hoje" quando a data é a de hoje; senão "do dia"
export const ehHoje = (data) => data === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Monta o texto que vai pro grupo, no formato de WhatsApp (*negrito*, _itálico_).
export function montarMensagem(jogos, data) {
  const cabecalho = `🏟️ *JOGOS ${ehHoje(data) ? 'DE HOJE' : 'DO DIA'} NA TV*\n📅 _${formatarData(data)}_`;
  if (!jogos.length) return `${cabecalho}\n\nNenhum jogo com transmissão encontrado.`;

  const blocos = jogos.map((j) => {
    const camp = j.rodada ? `${j.campeonato} · ${j.rodada}` : j.campeonato;
    const dia = rotuloDia(j, data);
    return `${ESPORTES[j.esporte].icone} *${j.horario}*${dia ? ` _(madrugada, ${dia})_` : ''} | ${j.mandante} x ${j.visitante}\n🏆 ${camp}\n📺 ${j.transmissao || 'A definir'}`;
  });

  return `${cabecalho}\n\n${blocos.join('\n\n')}`;
}
