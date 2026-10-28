// Gera as imagens da agenda do dia na pasta imagens/AAAA-MM-DD e avisa no Mac.
// Uso:
//   node gerar.js                  jogos de hoje
//   node gerar.js --data amanha    jogos de amanhã
//   node gerar.js --data 2026-10-28
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buscarTodos, chaveData } from './scraper.js';
import { filtrarJogos, montarMensagem, formatarData } from './mensagem.js';
import { gerarImagens } from './imagem.js';
import { gerarPagina, gerarIcs } from './pagina.js';
import { telegramLigado, enviarAgenda } from './telegram.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const args = process.argv.slice(2);
const argData = args[args.indexOf('--data') + 1];
const data = !args.includes('--data') ? chaveData() : argData === 'amanha' ? chaveData(1) : argData;
const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), '-', ...a);

// Notificação do macOS (aparece no canto da tela e fica na Central de Notificações).
// No servidor (GitHub Actions) não faz nada: lá o aviso é a release do dia.
const noMac = process.platform === 'darwin' && !process.env.CI;
const avisar = (titulo, texto) =>
  !noMac ? Promise.resolve() : new Promise((ok) => execFile('osascript', ['-e', `display notification ${JSON.stringify(texto)} with title ${JSON.stringify(titulo)} sound name "Glass"`], () => ok()));

try {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida. Use --data amanha ou --data AAAA-MM-DD');

  const jogos = filtrarJogos(await buscarTodos(config.esportes, data), config);
  const pasta = path.join(DIR, 'imagens', data);
  fs.mkdirSync(pasta, { recursive: true });
  fs.readdirSync(pasta).forEach((f) => fs.unlinkSync(path.join(pasta, f)));

  const imagens = jogos.length ? await gerarImagens(jogos, data, config) : [];
  imagens.forEach((img, i) => fs.writeFileSync(path.join(pasta, `jogos-${data}-${i + 1}.png`), img));
  fs.writeFileSync(path.join(pasta, 'mensagem.txt'), montarMensagem(jogos, data)); // versão em texto, se quiser colar

  // Página com os links do Google Agenda (publicada pelo GitHub Pages)
  const site = path.join(DIR, 'site');
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), gerarPagina(jogos, data));
  fs.writeFileSync(path.join(site, 'agenda.ics'), gerarIcs(jogos, data));

  // Imagens no Telegram (no GitHub, quando os segredos do bot existem)
  if (telegramLigado()) {
    await enviarAgenda(imagens, data, jogos.length, config.pagina)
      .then(() => log('Imagens enviadas no Telegram.'))
      .catch((e) => log('Telegram:', e.message)); // falha aqui não derruba a agenda
  }

  const resumo = imagens.length ? `${jogos.length} jogos em ${imagens.length} imagem(ns)` : 'Nenhum jogo com transmissão';
  log(`${formatarData(data)}: ${resumo} → ${pasta}`);
  await avisar(`Agenda de ${formatarData(data)} pronta`, `${resumo}. Pasta: ${pasta.replace(process.env.HOME, '~')}`);
  if (noMac && config.abrirPasta !== false) execFile('open', [pasta]);
} catch (err) {
  log('Erro:', err.message);
  await avisar('Agenda esportiva: erro', err.message);
  process.exit(1);
}
