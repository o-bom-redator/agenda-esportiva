// Bot do Telegram que transforma o post de gol do r/soccer em GIF com legenda pronta.
// Você cola no bot o título e o link do vídeo, ex.:
//   Milan 2-[4] Bologna - Samuel Mbangula hat trick 86'
//   https://streamin.link/v/57b4f2a6
// e ele devolve o GIF + a legenda no formato do canal.
//
// Uso: node bot.js   (precisa de TELEGRAM_TOKEN no arquivo .env)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerTitulo, acharJogo, jogosDeAgora, montarLegenda } from './gols.js';
import { fazerGif } from './gif.js';
import { iniciarAvisos, inicio } from './avisos.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const ENV = path.join(DIR, '.env');
try { process.loadEnvFile(ENV); } catch {}

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) {
  console.error('Falta o TELEGRAM_TOKEN no arquivo .env (veja o README, seção "Bot de gols").');
  process.exit(1);
}
// Só responde ao dono. O primeiro /start vira o dono e fica salvo no .env.
let dono = process.env.TELEGRAM_CHAT_ID;

const API = `https://api.telegram.org/bot${TOKEN}`;

// No GitHub Actions o bot roda em turnos (cada execução dura no máximo 6 h).
// PARAR_AS = horas UTC em que um turno acaba e o próximo começa, ex. "11,17,23".
// Ele para 2 min antes, pra não ficar dois bots ligados ao mesmo tempo.
function horaDeParar() {
  const horas = (process.env.PARAR_AS || '').split(',').filter(Boolean).map(Number);
  if (!horas.length) return Infinity;
  const hoje = new Date();
  const fins = horas.flatMap((h) => [0, 1].map((d) =>
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + d, h) - 2 * 60_000));
  const proximo = Math.min(...fins.filter((t) => t > Date.now() + 10 * 60_000));
  return Math.min(proximo, Date.now() + 350 * 60_000);
}
const PARAR = horaDeParar();
const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), '-', ...a);

async function telegram(metodo, dados) {
  const corpo = dados instanceof FormData ? dados : JSON.stringify(dados);
  const headers = dados instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(`${API}/${metodo}`, { method: 'POST', body: corpo, headers });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram (${metodo}): ${json.description}`);
  return json.result;
}

const responder = (chat, texto) => telegram('sendMessage', { chat_id: chat, text: texto, disable_web_page_preview: true });

async function enviarArquivo(metodo, campo, chat, arquivo, nome, legenda) {
  const form = new FormData();
  form.append('chat_id', String(chat));
  if (legenda) form.append('caption', legenda);
  form.append(campo, new Blob([fs.readFileSync(arquivo)]), nome);
  return telegram(metodo, form);
}

const AJUDA = `Cole aqui o título e o link do vídeo do gol, por exemplo:

Milan 2-[4] Bologna - Samuel Mbangula hat trick 86'
https://streamin.link/v/57b4f2a6

Se mandar só o link, eu faço o GIF e peço o título depois.

Também te aviso ${config.avisos?.minutosAntes ?? 15} minutos antes dos jogos principais, com o link de onde assistir. /avisos mostra os próximos.`;

// Vídeo que chegou sem título: espera a próxima mensagem com o título.
let pendente = null;

async function processar(chat, texto) {
  const links = texto.match(/https?:\/\/\S+/g) || [];
  const titulo = texto.replace(/https?:\/\/\S+/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');

  if (!links.length) {
    if (pendente && titulo) return entregar(chat, titulo, pendente);
    return responder(chat, AJUDA);
  }

  await telegram('sendChatAction', { chat_id: chat, action: 'upload_video' });
  const arquivos = await fazerGif(links[0]);
  if (!titulo) {
    pendente = arquivos;
    return responder(chat, '🎬 Vídeo pronto. Agora me mande o título do lance (ex.: Milan 2-[4] Bologna - Mbangula 86\').');
  }
  return entregar(chat, titulo, arquivos);
}

async function entregar(chat, titulo, arquivos) {
  pendente = null;
  const lance = lerTitulo(titulo);
  let legenda;
  if (lance) {
    const jogo = acharJogo(lance, await jogosDeAgora().catch(() => []));
    legenda = montarLegenda(lance, jogo);
    if (!jogo) legenda += '\n\n(não achei esse jogo na agenda de hoje: confira o campeonato)';
  } else {
    legenda = `⚽ ${titulo}\n\n(não entendi o título: ajuste a legenda)`;
  }
  try {
    await enviarArquivo('sendAnimation', 'animation', chat, arquivos.animacao, 'gol.mp4', legenda);
    await enviarArquivo('sendDocument', 'document', chat, arquivos.gif, 'gol.gif');
    await responder(chat, legenda); // texto solto, fácil de copiar
    log('GIF enviado:', titulo);
  } finally {
    fs.rmSync(arquivos.pasta, { recursive: true, force: true });
  }
}

async function salvarDono(chat) {
  dono = String(chat);
  const atual = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  fs.writeFileSync(ENV, `${atual.replace(/^TELEGRAM_CHAT_ID=.*\n?/m, '').trimEnd()}\nTELEGRAM_CHAT_ID=${dono}\n`);
}

// Avisos de início de jogo (vão pro dono; você copia pro canal)
let proximos = () => [];
function ligarAvisos() {
  proximos = iniciarAvisos(config, (texto) => responder(dono, texto), log, path.join(DIR, 'estado', 'avisados.json'));
}
if (dono) ligarAvisos();

function listarProximos() {
  const jogos = proximos().slice(0, 15);
  if (!jogos.length) return 'Nenhum aviso programado por enquanto.';
  const hora = (j) => inicio(j).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return `⏰ Próximos avisos (${config.avisos?.minutosAntes ?? 15} min antes):\n\n${jogos.map((j) => `${hora(j)} · ${j.mandante} x ${j.visitante} (${j.campeonato})`).join('\n')}`;
}

// Fica perguntando ao Telegram se chegou mensagem nova (long polling).
let offset = 0;
let trabalhando = 0; // GIFs sendo feitos agora
log('Bot de gols ligado. Mande /start pra ele no Telegram.');
if (PARAR < Infinity) log('Este turno termina às', new Date(PARAR).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
while (Date.now() < PARAR) {
  try {
    const espera = Math.max(1, Math.min(50, Math.floor((PARAR - Date.now()) / 1000)));
    const updates = await telegram('getUpdates', { offset, timeout: espera, allowed_updates: ['message'] });
    for (const u of updates) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg?.text) continue;
      const chat = msg.chat.id;
      if (!dono && msg.text.startsWith('/start')) {
        await salvarDono(chat);
        log('Dono do bot salvo:', chat);
        ligarAvisos();
      }
      if (String(chat) !== dono) {
        await responder(chat, 'Este bot é particular.');
        continue;
      }
      if (msg.text.startsWith('/avisos')) {
        await responder(chat, listarProximos());
        continue;
      }
      if (msg.text.startsWith('/')) {
        await responder(chat, `👋 Tudo certo!\n\n${AJUDA}`);
        continue;
      }
      trabalhando++;
      processar(chat, msg.text)
        .catch((e) => {
          log('Erro:', e.message);
          return responder(chat, `❌ Não consegui: ${e.message}`).catch(() => {});
        })
        .finally(() => trabalhando--);
    }
  } catch (e) {
    log('Falha ao falar com o Telegram:', e.message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// Fim do turno: termina os GIFs em andamento, confirma as mensagens lidas e sai.
for (let i = 0; trabalhando > 0 && i < 120; i++) await new Promise((r) => setTimeout(r, 1000));
await telegram('getUpdates', { offset, timeout: 0 }).catch(() => {});
log('Fim do turno.');
process.exit(0);
