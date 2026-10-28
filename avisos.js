// Avisos de "o jogo vai começar": X minutos antes de cada jogo escolhido, manda uma mensagem
// com o horário, o campeonato e o link do canal que transmite.
//
// Em vez de criar uma tarefa pra cada jogo, olha a agenda a cada 30 s e avisa os jogos que
// entraram na janela. Assim nada se perde se o Mac dormir ou o bot reiniciar: ao voltar,
// ele avisa o que ainda não começou.
import fs from 'node:fs';
import path from 'node:path';
import { ESPORTES, buscarTodos, VIRADA } from './scraper.js';
import { filtrarJogos } from './mensagem.js';
import { separarCanais } from './imagem.js';
import { linkCanal } from './canais.js';

const ATUALIZAR = 2 * 3_600_000; // relê a agenda do futnatv a cada 2 h (horário pode mudar)
const MINIMO = 3 * 60_000; // se faltar menos de 3 min, já não vale avisar

// Hora de início do jogo (horário de Brasília, sem horário de verão)
export const inicio = (j) => new Date(`${j.data}T${j.horario.replace('h', ':').padEnd(5, '0')}:00-03:00`);

const escolhido = (j, campeonatos) =>
  !campeonatos?.length || campeonatos.some((c) => c.toLowerCase() === j.campeonato.toLowerCase());

// ['A', 'B', 'C'] → "A, B e C" (sem repetir)
function lista(nomes) {
  const itens = [...new Set(nomes)];
  return itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}` : itens[0];
}

// Canais do jogo e uma linha "👉 Canal: link" por site (ESPN e Disney+ caem no mesmo link)
function transmissao(j) {
  const canais = separarCanais(j.transmissao || '').map((c) => linkCanal(c, j));
  const porLink = Map.groupBy(canais.filter((c) => c.link), (c) => c.link);
  const links = [...porLink].map(([link, cs]) => `👉 ${lista(cs.map((c) => c.nome))}: ${link}`).join('\n');
  return { texto: canais.length ? lista(canais.map((c) => c.nome)) : 'a definir', links };
}

// "pelo Campeonato Italiano", "pela Copa do Rei"
const pelo = (campeonato) => (/^(campeonato|brasileir|paulist|cariocão|mineiro|gaúcho|nbb)/i.test(campeonato) ? 'pelo' : 'pela');

// Formato WhatsApp (*negrito*). Um jogo: frase corrida. Vários no mesmo horário: lista.
export function montarAviso(jogos, minutos) {
  const quando = `Daqui a ${minutos} minuto${minutos > 1 ? 's' : ''}, às ${jogos[0].horario}`;
  if (jogos.length === 1) {
    const j = jogos[0];
    const t = transmissao(j);
    return `⏰ ${quando}, começa *${j.mandante} x ${j.visitante}* ${pelo(j.campeonato)} ${j.campeonato}.\n📺 Transmissão: ${t.texto}${t.links ? `\n\n${t.links}` : ''}`;
  }
  return `⏰ *${quando}, começam:*\n\n${jogos.map(bloco).join('\n\n')}`;
}

// Um jogo na lista: times, campeonato e onde assistir
function bloco(j) {
  const t = transmissao(j);
  return `${ESPORTES[j.esporte].icone} *${j.mandante} x ${j.visitante}*\n🏆 ${j.campeonato}\n${t.links || `📺 ${t.texto}`}`;
}

// Na hora do jogo: "A bola rola para:" + os jogos do horário
export function montarBolaRolando(jogos) {
  return `🟢 *A bola rola para:* (${jogos[0].horario})\n\n${jogos.map(bloco).join('\n\n')}`;
}

// Jogos já avisados ficam guardados em `arquivo` (se informado), pra não repetir o aviso
// quando o bot reinicia (no GitHub Actions ele reinicia a cada 6 h).
function lerAvisados(arquivo) {
  try { return new Set(JSON.parse(fs.readFileSync(arquivo, 'utf8'))); } catch { return new Set(); }
}
function salvarAvisados(arquivo, avisados) {
  const anteontem = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const recentes = [...avisados].filter((chave) => chave.slice(0, 10) >= anteontem);
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(recentes));
}

// Liga os avisos. `enviar(texto)` é quem manda a mensagem (no bot, pro seu Telegram).
export function iniciarAvisos(config, enviar, log = console.log, arquivo = '') {
  const { minutosAntes = 15, campeonatos = [], noInicio = true } = config.avisos || {};
  const avisados = arquivo ? lerAvisados(arquivo) : new Set();
  let jogos = [];
  let lidoEm = 0;

  async function atualizar() {
    if (Date.now() - lidoEm < ATUALIZAR) return;
    lidoEm = Date.now();
    try {
      // a agenda do dia vale das 6h às 5h59; perto da virada, já olha a do dia seguinte também
      const datas = [-VIRADA, 6 - VIRADA].map((h) =>
        new Date(Date.now() + h * 3_600_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }));
      const todos = [];
      for (const d of new Set(datas)) todos.push(...(await buscarTodos(config.esportes, d)));
      const vistos = new Set();
      jogos = filtrarJogos(todos, config).filter((j) => escolhido(j, campeonatos)).filter((j) => {
        const chave = `${j.data} ${j.horario} ${j.mandante} ${j.visitante}`;
        return !vistos.has(chave) && vistos.add(chave);
      });
      log(`Avisos: ${jogos.length} jogos na lista.`);
    } catch (e) {
      lidoEm = Date.now() - ATUALIZAR + 10 * 60_000; // tenta de novo em 10 min
      log('Avisos: não consegui ler a agenda:', e.message);
    }
  }

  async function verificar() {
    await atualizar();
    const agora = Date.now();
    const prontos = jogos.filter((j) => {
      const falta = inicio(j) - agora;
      return falta >= MINIMO && falta <= minutosAntes * 60_000 && !avisados.has(`${j.data} ${j.horario} ${j.mandante}`);
    });
    await avisar(prontos, '', (grupo) => montarAviso(grupo, Math.round((inicio(grupo[0]) - agora) / 60_000)));

    // Na hora marcada (até 5 min depois, se o bot estava reiniciando): "A bola rola para:"
    if (noInicio) {
      const rolando = jogos.filter((j) => {
        const falta = inicio(j) - agora;
        return falta <= 0 && falta > -5 * 60_000 && !avisados.has(`${j.data} ${j.horario} ${j.mandante} #rola`);
      });
      await avisar(rolando, ' #rola', montarBolaRolando);
    }
  }

  // Um aviso por horário; marca os jogos como avisados (sufixo diferencia os dois tipos)
  async function avisar(lista, sufixo, montar) {
    for (const grupo of Map.groupBy(lista, (j) => `${j.data} ${j.horario}`).values()) {
      grupo.forEach((j) => avisados.add(`${j.data} ${j.horario} ${j.mandante}${sufixo}`));
      if (arquivo) salvarAvisados(arquivo, avisados);
      await enviar(montar(grupo)).catch((e) => log('Avisos: falha ao enviar:', e.message));
      log(`${sufixo ? 'Bola rolando' : 'Aviso'} enviado: ${grupo.map((j) => `${j.mandante} x ${j.visitante}`).join(', ')}`);
    }
  }

  verificar();
  setInterval(verificar, 30_000);
  // Próximos avisos (pro comando /avisos do bot)
  return () => jogos.filter((j) => inicio(j) - Date.now() >= MINIMO).sort((a, b) => inicio(a) - inicio(b));
}
