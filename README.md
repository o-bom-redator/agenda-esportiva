# 📅 Agenda esportiva do dia

Gera, todo dia às **5h (Brasília)**, a agenda de jogos transmitidos na TV e no streaming, com dados do [futnatv.net](https://futnatv.net): **futebol, basquete, vôlei e NFL**.

São dois formatos:

- **Imagens** prontas pra compartilhar em grupos e canais (WhatsApp, Telegram, Instagram...).
- **Página web** em que cada jogo tem um botão **"Salvar na agenda"**, que abre o Google Agenda já preenchido.

👉 **Página do dia:** https://o-bom-redator.github.io/agenda-esportiva/
👉 **Imagens do dia:** [Releases](https://github.com/o-bom-redator/agenda-esportiva/releases)

<p align="center"><img src="docs/exemplo-imagem.png" width="520" alt="Exemplo da imagem da agenda"></p>

---

## Como funciona

```
GitHub Actions (todo dia às 5h)
   │
   ├─ scraper.js  → busca os jogos do dia na API do futnatv (por esporte e data)
   ├─ mensagem.js → aplica filtros (sem categorias de base) e monta a versão em texto
   ├─ imagem.js   → desenha a agenda em HTML e tira "foto" com o Chrome (Puppeteer)
   ├─ pagina.js   → gera a página com os links do Google Agenda e o arquivo .ics
   │
   ├─ Release "Agenda DD/MM" → imagens PNG + mensagem.txt (apaga a do dia anterior)
   └─ GitHub Pages           → página atualizada
```

O GitHub avisa por e-mail e no app quando sai a release nova. Se o aviso não chegar, ative em **Watch → Custom → Releases** no repositório.

### O que vai na agenda

- **Esportes:** jogos com transmissão confirmada de futebol, basquete (NBA, NBB, EuroLiga...), vôlei e NFL.
- **Público:** profissional masculino e feminino. Categorias de base (sub-17, sub-20, U21, juniores, youth...) ficam de fora.
- **Ordem:** por horário. Jogos de madrugada (ex.: NBA 00h00) vão pro fim do dia.
- **Imagens:** quando há muitos jogos, a agenda é dividida em várias imagens ("Parte 1 de 3").
- **Cores dos canais:**
  - 🔴 YouTube/CazéTV (grátis)
  - 🟣 streaming
  - 🔵 TV

### A página

- **Salvar na agenda:** cada jogo tem um botão que abre o Google Agenda com título, horário, campeonato e onde assistir.
- **Filtro:** dá pra mostrar só um esporte.
- **Todos de uma vez:** o arquivo **agenda.ics** adiciona todos os jogos de uma vez (iPhone, Outlook, Google).
- **Celular e modo escuro:** a página funciona bem no celular e no modo escuro.

Sugestão de legenda pra postar junto com as imagens:

> 📅 Jogos de hoje na TV! Quer salvar algum na agenda? Toque aqui: https://o-bom-redator.github.io/agenda-esportiva/

---

## Gerar fora do horário

**No GitHub:** **Actions → Agenda do dia → Run workflow**, depois escolha `hoje`, `amanha` ou uma data (`2026-10-28`).

**No computador** (precisa do [Node.js](https://nodejs.org) 20 ou mais novo):

```bash
npm install
node gerar.js                  # jogos de hoje
node gerar.js --data amanha    # jogos de amanhã
node gerar.js --data 2026-10-28
```

As imagens ficam em `imagens/AAAA-MM-DD/` e a página em `site/`. No Mac, aparece uma notificação e a pasta abre sozinha.

---

## Configuração (`config.json`)

| Opção | O que faz |
|---|---|
| `esportes` | Quais esportes entram: `futebol`, `basquete`, `volei`, `nfl` |
| `ocultarBase` | `true` tira jogos de categorias de base (sub-17, sub-20, U21...) |
| `ocultarFemininos` | `true` tira jogos femininos |
| `ocultarCampeonatos` | Lista de campeonatos a esconder, ex. `["MLS", "Campeonato Saudita"]` |
| `jogosPorImagem` | Acima disso, divide em mais imagens (padrão 22) |
| `abrirPasta` | No Mac, abre a pasta das imagens ao terminar (padrão `true`) |

Depois de alterar, faça commit e push pra que o GitHub use a versão nova.

---

## Arquivos

| Arquivo | Função |
|---|---|
| `gerar.js` | Script principal: busca, filtra, gera imagens, texto e página |
| `scraper.js` | Busca os jogos na API do futnatv |
| `mensagem.js` | Filtros e versão em texto (formato WhatsApp) |
| `imagem.js` | Layout e geração das imagens PNG |
| `pagina.js` | Página com links do Google Agenda e arquivo `.ics` |
| `.github/workflows/agenda.yml` | Agendamento diário, release e GitHub Pages |
| `agendar.sh` | Alternativa: agendar no próprio Mac (launchd). Fica desligado |
| `enviar.js` | Alternativa: envio automático pra um grupo de WhatsApp (whatsapp-web.js, não oficial). Fica desligado |

---

## Observações

- **Origem dos dados:** os dados vêm do futnatv.net. Se o site mudar a API, a busca pode parar de funcionar, e o erro aparece na aba **Actions**.
- **Atraso:** o GitHub pode atrasar alguns minutos o horário agendado.
- **Duração dos eventos:** a duração dos jogos na agenda é estimada (futebol e vôlei 2h, basquete 2h30, NFL 3h30).
