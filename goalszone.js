// Busca automática dos gols no goals.zone, que junta os clipes de gol postados no r/soccer.
// A cada minuto lê a lista de jogos com gols (1 consulta). Quando o placar de um jogo da
// nossa agenda muda, busca os vídeos desse jogo e entrega os que ainda não foram enviados.
import fs from 'node:fs';
import path from 'node:path';
import { lerTitulo, acharJogo, jogosDeAgora } from './gols.js';

const API = 'https://gogz.meneses.pt/api';
const INTERVALO = 60_000;
const RECENTES = 4 * 3_600_000; // só olha jogos que começaram nas últimas 4 h
const ESPERA = 20 * 60_000; // o placar costuma mudar antes do clipe sair: espera o vídeo até 20 min
const TENTAR = 15 * 60_000; // logo que o gol é postado o vídeo ainda pode estar processando: tenta de novo por 15 min
const CABECALHO = { 'User-Agent': 'agenda-esportiva-bot (+https://github.com/o-bom-redator/agenda-esportiva)' };

async function api(caminho) {
  const res = await fetch(`${API}${caminho}${caminho.includes('?') ? '&' : '?'}format=json`, { headers: CABECALHO });
  if (!res.ok) throw new Error(`goals.zone respondeu ${res.status}`);
  return res.json();
}

// Estado guardado entre turnos: vídeos já enviados e último placar visto de cada jogo
function lerEstado(arquivo) {
  try {
    const e = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    return { novo: false, enviados: new Set(e.enviados), placares: new Map(Object.entries(e.placares)) };
  } catch {
    return { novo: true, enviados: new Set(), placares: new Map() };
  }
}
function salvarEstado(arquivo, estado) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify({
    enviados: [...estado.enviados].slice(-2000),
    placares: Object.fromEntries([...estado.placares].slice(-500)),
  }));
}

// `campeonatos`: só jogos desses campeonatos (nome igual ao do futnatv). Vazio = todos da agenda.
// `entregar(titulo, links)`: faz o GIF e manda (no bot, pro seu Telegram).
export function iniciarGols({ arquivo, campeonatos = [], entregar, log = console.log }) {
  const estado = lerEstado(arquivo);
  const escolhidos = new Set(campeonatos.map((c) => c.toLowerCase()));
  let primeira = estado.novo; // na primeira vez, só anota o que já existe (não manda gol antigo)
  let rodando = false;
  const esperando = new Map(); // jogo → desde quando falta clipe de algum gol
  const falhas = new Map(); // vídeo → quando falhou a primeira vez

  async function verificar() {
    if (rodando) return; // ainda processando a rodada anterior
    rodando = true;
    try {
      const todos = await jogosDeAgora().catch(() => []);
      if (!todos.length) return; // sem agenda (futnatv fora do ar): tenta de novo no próximo minuto
      const agenda = todos.filter((j) => !escolhidos.size || escolhidos.has(j.campeonato.toLowerCase()));
      const lista = await api('/matches/?limit=50&offset=0');
      for (const m of lista) {
        if (Date.now() - new Date(m.datetime) > RECENTES) continue;
        if (estado.placares.get(m.slug) === m.score) continue;
        const jogo = acharJogo({ mandante: m.home_team.name, visitante: m.away_team.name }, agenda);
        if (!jogo) {
          estado.placares.set(m.slug, m.score); // fora da nossa lista: ignora
          continue;
        }
        const detalhe = await api(`/matches/${m.slug}`);
        const gols = m.score.split(':').reduce((t, n) => t + (Number(n) || 0), 0);
        const comVideo = (detalhe.videos || []).filter((v) => lerTitulo(v.title)).length;
        let tentarDeNovo = false;
        for (const v of detalhe.videos || []) {
          if (estado.enviados.has(v.simple_permalink)) continue;
          estado.enviados.add(v.simple_permalink);
          if (primeira || !lerTitulo(v.title)) continue; // gol antigo ou post que não é de gol
          const links = (v.mirrors || []).map((x) => x.url);
          try {
            await entregar(v.title, links);
            falhas.delete(v.simple_permalink);
          } catch (e) {
            const primeiraFalha = falhas.get(v.simple_permalink) ?? Date.now();
            if (Date.now() - primeiraFalha < TENTAR) {
              if (!falhas.has(v.simple_permalink)) log('Gols: falha em', v.title, '-', e.message, '(vou tentar de novo)');
              falhas.set(v.simple_permalink, primeiraFalha);
              estado.enviados.delete(v.simple_permalink);
              tentarDeNovo = true;
            } else {
              log('Gols: desisti de', v.title, '-', e.message);
              falhas.delete(v.simple_permalink);
            }
          }
        }
        // Falta clipe de algum gol (ou um falhou): olha esse jogo de novo no próximo minuto
        const desde = esperando.get(m.slug) ?? Date.now();
        if (tentarDeNovo || (comVideo < gols && Date.now() - desde < ESPERA)) {
          esperando.set(m.slug, desde);
        } else {
          esperando.delete(m.slug);
          estado.placares.set(m.slug, m.score);
        }
        salvarEstado(arquivo, estado);
      }
      if (primeira) log('Gols: primeira leitura feita, os próximos gols serão enviados.');
      primeira = false;
      salvarEstado(arquivo, estado);
    } catch (e) {
      log('Gols:', e.message);
    } finally {
      rodando = false;
    }
  }

  verificar();
  setInterval(verificar, INTERVALO);
}
