// Uso:
//   node enviar.js --teste   gera as imagens na pasta "previa" e mostra o texto (não abre o WhatsApp)
//   node enviar.js --login   mostra o QR code pra conectar e lista seus grupos
//   node enviar.js           busca os jogos e envia pro grupo do config.json
// Em qualquer modo dá pra escolher o dia: --data amanha  ou  --data 2026-10-28
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import { buscarTodos, chaveData } from './scraper.js';
import { filtrarJogos, montarMensagem, formatarData } from './mensagem.js';
import { gerarImagens } from './imagem.js';

const { Client, LocalAuth, MessageMedia } = wweb;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const args = process.argv.slice(2);
const modo = args.find((a) => a === '--teste' || a === '--login');
const argData = args[args.indexOf('--data') + 1];
const data = !args.includes('--data') ? chaveData() : argData === 'amanha' ? chaveData(1) : argData;
if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
  console.error('Data inválida. Use --data amanha ou --data AAAA-MM-DD');
  process.exit(1);
}
const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), '-', ...a);

// Busca, filtra e prepara o conteúdo: { texto, imagens }
async function prepararConteudo() {
  const jogos = filtrarJogos(await buscarTodos(config.esportes, data), config);
  const texto = montarMensagem(jogos, data);
  const imagens = config.formato === 'texto' || !jogos.length ? [] : await gerarImagens(jogos, data, config);
  return { texto, imagens, total: jogos.length };
}

if (modo === '--teste') {
  const { texto, imagens } = await prepararConteudo();
  const pasta = path.join(DIR, 'previa');
  fs.mkdirSync(pasta, { recursive: true });
  fs.readdirSync(pasta).filter((f) => f.endsWith('.png')).forEach((f) => fs.unlinkSync(path.join(pasta, f)));
  imagens.forEach((img, i) => fs.writeFileSync(path.join(pasta, `jogos-${data}-${i + 1}.png`), img));
  console.log(texto);
  if (imagens.length) console.log(`\n${imagens.length} imagem(ns) salva(s) em ${pasta}`);
  process.exit(0);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(DIR, '.sessao-whatsapp') }),
  puppeteer: { headless: true, args: ['--no-sandbox'] },
});

const timeout = setTimeout(() => {
  log(modo === '--login' ? 'Tempo esgotado esperando o QR code.' : 'WhatsApp não conectou em 3 min. Rode "node enviar.js --login" de novo.');
  process.exit(1);
}, 180_000);

client.on('qr', (qr) => {
  if (modo !== '--login') {
    log('Sessão expirada: rode "node enviar.js --login" e escaneie o QR code.');
    process.exit(1);
  }
  console.log('\nNo celular: WhatsApp > Aparelhos conectados > Conectar aparelho\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  clearTimeout(timeout);
  try {
    const grupos = (await client.getChats()).filter((c) => c.isGroup);

    if (modo === '--login') {
      log('Conectado! Seus grupos (copie o nome exato pro config.json):');
      grupos.forEach((g) => console.log('  -', g.name));
    } else {
      const grupo = grupos.find((g) => g.name.trim() === config.grupo.trim());
      if (!grupo) throw new Error(`Grupo "${config.grupo}" não encontrado. Confira o nome no config.json.`);
      const { texto, imagens, total } = await prepararConteudo();
      const id = grupo.id._serialized;

      if (imagens.length) {
        for (const [i, img] of imagens.entries()) {
          const media = new MessageMedia('image/png', img.toString('base64'), `jogos-${i + 1}.png`);
          const legenda = i === 0 ? `🏟️ *Jogos na TV*: ${formatarData(data)} (${total} jogos)` : undefined;
          await client.sendMessage(id, media, { caption: legenda });
        }
      } else {
        await client.sendMessage(id, texto);
      }
      log(`Enviado para "${grupo.name}": ${imagens.length ? `${imagens.length} imagem(ns)` : 'texto'}, ${total} jogos.`);
      await new Promise((r) => setTimeout(r, 8000)); // dá tempo das mensagens saírem antes de fechar
    }
    await client.destroy();
    process.exit(0);
  } catch (err) {
    log('Erro:', err.message);
    await client.destroy().catch(() => {});
    process.exit(1);
  }
});

log('Abrindo WhatsApp Web...');
client.initialize();
