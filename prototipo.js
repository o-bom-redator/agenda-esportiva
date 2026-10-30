// Prévia local do futuro site "Partidas do Dia" (não publica nada nem manda Telegram).
// Usa os mesmos dados da agenda, com o header novo (busca e menus). Uso:
//   node prototipo.js            → previa/partidas-do-dia.html (e abre no navegador, no Mac)
//   node prototipo.js 2026-11-01
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buscarDias, chaveData } from './scraper.js';
import { filtrarJogos } from './mensagem.js';
import { gerarPagina } from './pagina.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const data = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || chaveData();

const semana = (await buscarDias(config.esportes, data, config.diasNoSite ?? 7)).map((d) => ({ ...d, jogos: filtrarJogos(d.jogos, config) }));
const arquivo = path.join(DIR, 'previa', 'partidas-do-dia.html');
fs.mkdirSync(path.dirname(arquivo), { recursive: true });
fs.writeFileSync(arquivo, gerarPagina(semana[0].jogos, data, semana, { modelo: 'partidas' }));
console.log('Prévia gerada:', arquivo);
if (process.platform === 'darwin' && !process.env.CI && !process.argv.includes('--sem-abrir')) execFile('open', [arquivo]);
