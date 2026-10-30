// Padroniza os nomes das emissoras (futnatv e oGol escrevem diferente: "PFC" = Premiere,
// "CTV" = CazéTV...). A lista fica em emissoras.json, pra editar à mão.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'emissoras.json');
const NOMES = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).nomes;

// Nomes que não estão no emissoras.json (o gerar.js avisa no log)
export const desconhecidas = new Set();

export function padronizar(nome) {
  if (NOMES[nome]) return NOMES[nome];
  const base = nome.replace(/\s*\(.*\)\s*$/, ''); // "Globo (SP)": variação regional de um nome conhecido
  if (!NOMES[base]) desconhecidas.add(nome);
  const yt = nome.match(/^(?:YouTube|YT) \((.+)\)$/i); // canal novo do YouTube: segue o padrão
  return yt ? `${yt[1]} (YouTube)` : nome;
}

// Nome usado no filtro do site: sem o que está entre parênteses ("Globo (SP)" → "Globo")
export const emissoraDoFiltro = (nome) => nome.replace(/\s*\(.*\)\s*$/, '').trim() || nome;
