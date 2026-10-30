# 📅 Agenda esportiva do dia

Gera, todo dia **de manhã cedo (a partir das 4h17, Brasília)**, a agenda de jogos transmitidos na TV e no streaming, com dados do [futnatv.net](https://futnatv.net) e do [oGol](https://www.ogol.com.br/zapping) (futebol): **futebol, basquete, vôlei e NFL**.
Na página, o seletor **📺 Emissora** mostra todos os jogos de uma emissora nos próximos 7 dias.

São dois formatos:

- **Imagens** prontas pra compartilhar em grupos e canais (WhatsApp, Telegram, Instagram...).
- **Página web** em que cada jogo tem um botão **"Salvar na agenda"**, que abre o Google Agenda já preenchido.

👉 **Página do dia:** https://o-bom-redator.github.io/agenda-esportiva/
👉 **Imagens do dia:** [Releases](https://github.com/o-bom-redator/agenda-esportiva/releases)

<p align="center"><img src="docs/exemplo-imagem.png" width="520" alt="Exemplo da imagem da agenda"></p>

---

## Como funciona

```
GitHub Actions (todo dia a partir das 4h17, com horários de reserva até 7h47)
   │
   ├─ scraper.js  → busca os jogos do dia na API do futnatv (por esporte e data) e junta os do oGol
   ├─ mensagem.js → aplica filtros (sem categorias de base) e monta a versão em texto
   ├─ imagem.js   → desenha a agenda em HTML e tira "foto" com o Chrome (Puppeteer)
   ├─ pagina.js   → gera a página com os links do Google Agenda e o arquivo .ics
   │
   ├─ Release "Agenda DD/MM" → imagens PNG + mensagem.txt (apaga a do dia anterior)
   └─ GitHub Pages           → página atualizada
```

As imagens também chegam no seu **Telegram**, pelo bot dos gols, num álbum com a legenda pronta pra postar no canal. É só configurar os segredos do bot (veja "Bot de gols"). Sem eles, as imagens ficam só na release.

O GitHub também avisa por e-mail e no app quando sai a release nova. Se o aviso não chegar, ative em **Watch → Custom → Releases** no repositório.

### O que vai na agenda

- **Esportes:** jogos com transmissão confirmada de futebol, basquete (NBA, NBB, EuroLiga...), vôlei e NFL.
- **Público:** profissional masculino e feminino. Categorias de base (sub-17, sub-20, U21, juniores, youth...) ficam de fora.
- **Ordem:** por horário. A agenda de um dia vai das 6h até a madrugada seguinte, como numa grade de TV. Os jogos da madrugada (ex.: NBA 00h00) ficam no fim, marcados com a data real (ex.: "qui, 29/10"), e entram no Google Agenda nesse dia.
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

## Bot de gols (Telegram)

O bot manda os gols dos jogos do dia em GIF, com legenda pronta pro canal, de dois jeitos.

### Automático (goals.zone + r/futebol)

O bot olha duas fontes. Quando sai um gol num jogo da agenda do dia, ele baixa o vídeo, faz o GIF e te manda. Você não precisa fazer nada.

- **[goals.zone](https://goals.zone)**, a cada minuto: junta os clipes de gol do r/soccer (forte no futebol europeu).
- **[r/futebol](https://www.reddit.com/r/futebol/)**, a cada 2 minutos: posts novos (forte no Brasileirão; a busca pela etiqueta Lances atrasa, por isso lemos os novos). Só entram os posts de gol, com o placar entre colchetes (ex.: `Bahia 2 x [2] São Paulo | 50' Bobadilla`). Polêmicas e defesas ficam de fora.
- **Sem repetir:** o mesmo gol (jogo + placar) só chega uma vez, mesmo que apareça nas duas fontes ou em vários vídeos.
- **Quais jogos:** só os campeonatos de `avisos.campeonatos` no `config.json`. Pra usar uma lista diferente da dos avisos, crie `gols.campeonatos`. Pra desligar, use `"gols": { "automatico": false }`.
- **Uso educado:** o bot faz poucas consultas e se identifica. Os termos do goals.zone não permitem republicar o conteúdo deles. Se alguma fonte bloquear o acesso, a outra e o modo manual continuam funcionando.

### Grupo do Telegram

Pra receber avisos, gols e a agenda num grupo: adicione o bot no grupo e mande `/grupo` lá. Ele responde com o id do grupo. Coloque esse id no `config.json` (`"telegram": { "grupo": "-100..." }`), assim a agenda da manhã também vai pro grupo. `/privado` (no grupo) volta a mandar tudo no seu chat.

### Manual (colar o link)

Pra um gol que o automático não pegou, cole no bot o título e o link do vídeo:

```
Milan 2-[4] Bologna - Samuel Mbangula hat trick 86'
https://streamin.link/v/57b4f2a6
```

Nos dois modos, ele devolve:

- **Animação:** o vídeo sem som, que o Telegram mostra como GIF.
- **Legenda:** no formato do canal, com o campeonato e a rodada puxados da agenda do dia:
  ```
  🇮🇹 *Milan 2x4 Bologna* 🇮🇹
  ⚽ Samuel Mbangula (hat-trick) / 86'
  🏆 Campeonato Italiano | 9ª Rodada
  ```

No modo manual, se mandar só o link, ele faz o GIF e pede o título em seguida. Os detalhes em inglês viram português: OG → gol contra, penalty → pênalti, hat trick, free kick → falta, great goal → golaço.

**Links aceitos:** streamin.link / streamin.me, streama.in / streamain.com e qualquer link direto de `.mp4`, com ou sem `https://`.

### Onde o bot roda

No **GitHub Actions** (workflow `bot.yml`), **o dia todo**, em turnos de até 6 h que acabam às 2h, 8h, 14h e 20h (Brasília). O workflow é agendado de hora em hora: com o bot já ligado, a próxima execução espera na fila e assume quando o turno atual acaba. São vários agendamentos porque o GitHub não garante o horário: em hora cheia ele atrasa horas ou pula.

Pra mudar os horários, edite o `cron` e o `PARAR_AS` no `.github/workflows/bot.yml`. Quando tiver um servidor próprio, o bot roda direto lá com `node bot.js`, sem turnos.

### Configurar (uma vez)

1. No Telegram, abra o **@BotFather**, mande `/newbot` e escolha um nome. Ele te dá um **token**.
2. Descubra o seu número de chat: mande qualquer mensagem pro **@userinfobot** no Telegram. Ele responde com o seu `Id`.
3. No GitHub, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie dois segredos:
   - `TELEGRAM_TOKEN`: o token do BotFather
   - `TELEGRAM_CHAT_ID`: o seu número de chat
   - `REDDIT_CLIENT_ID` e `REDDIT_CLIENT_SECRET` (recomendado): chaves de um app "script" criado em
     https://www.reddit.com/prefs/apps. Sem elas o Reddit bloqueia (403) a leitura vinda do GitHub.
4. Ligue o primeiro turno em **Actions → Bot de gols e avisos → Run workflow**. Os próximos ligam sozinhos.
5. No Telegram, abra o seu bot e mande `/start`.

**Pra testar no computador:** copie `.env.exemplo` pra `.env`, cole o token e rode `npm run bot`. Desligue o bot do GitHub antes (**Actions → Bot de gols e avisos → ··· → Disable workflow**), porque o Telegram não deixa dois bots iguais ligados ao mesmo tempo.

### Avisos de início de jogo

O mesmo bot te avisa **30 minutos antes** dos jogos principais, com o link de onde assistir, pra você colar no canal:

```
⏰ Daqui a 30 minutos, às 19h30, começa *Fluminense x Internacional* pelo Brasileirão - Série A.
📺 Transmissão: Record, Premiere e CazéTV

👉 Record: https://recordplus.com
👉 Premiere: https://globoplay.globo.com
👉 CazéTV: https://www.youtube.com/@CazeTV/streams
```

- **Bola rolando:** na hora marcada, chega um segundo aviso, "🟢 A bola rola para:", com os jogos daquele horário e os links. Pra desligar, use `avisos.noInicio: false`.
- **Agrupados:** jogos que começam no mesmo horário saem numa mensagem só.
- **Links:** levam pro site do canal (Disney+, Globoplay, HBO Max...). Quem tem conta já cai no ao vivo. Pros canais do YouTube (CazéTV, GE TV, XSports, NBB...), o link abre a aba de lives do canal oficial. Os links ficam em `canais.js`, e dá pra trocá-los por links de afiliado no futuro.
- **Quais jogos:** só os campeonatos listados em `avisos.campeonatos` no `config.json`. O nome precisa ser igual ao do futnatv (ex.: `Brasileirão - Série A`, `Campeonato Italiano`, `NBA`). Com a lista vazia, avisa todos.
- **Antecedência:** `avisos.minutosAntes` (hoje 30).
- **Próximos avisos:** mande `/avisos` pro bot.
- **Sem perder aviso:** o bot relê a agenda a cada 30 minutos, então pega mudanças de horário. Na troca de turno, ele lembra quais jogos já avisou. Se um turno começar atrasado, ainda avisa os jogos que não começaram, com os minutos que faltam.

**Alternativa no Mac:** o `./bot.sh` deixa o bot ligado no Mac (liga ao entrar e volta se cair), e `./bot.sh remover` desliga. Só funciona com o Mac ligado.

Os vídeos são das emissoras donas dos direitos. Use com moderação e sem fins comerciais.

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
| `pagina` | Link da página da agenda, usado na legenda do Telegram |
| `abrirPasta` | No Mac, abre a pasta das imagens ao terminar (padrão `true`) |
| `avisos.minutosAntes` | Quantos minutos antes do jogo o bot avisa (hoje 30) |
| `avisos.noInicio` | `true` também avisa na hora do jogo ("A bola rola para:") |
| `avisos.campeonatos` | Campeonatos que geram aviso, com o nome igual ao do futnatv. Vazio = todos |
| `gols.automatico` | `true` manda os gols sozinho (goals.zone). `false` deixa só o modo manual |
| `gols.campeonatos` | Opcional: campeonatos dos gols automáticos. Sem ela, usa a lista dos avisos |
| `telegram.grupo` | Id do grupo do Telegram que recebe avisos, gols e agenda. Sem ele, vai pro seu privado |

Depois de alterar, faça commit e push pra que o GitHub use a versão nova.

---

## Arquivos

| Arquivo | Função |
|---|---|
| `gerar.js` | Script principal: busca, filtra, gera imagens, texto e página |
| `scraper.js` | Busca os jogos na API do futnatv e junta os do oGol |
| `ogol.js` | Lê o feed de transmissões do oGol (reforço do futnatv; se um cair, o outro segura) |
| `emissoras.json` | Nomes padronizados das emissoras (ex.: `PFC` → Premiere, `CTV` → CazéTV). Edite à mão |
| `emissoras.js` | Aplica o `emissoras.json`; nome novo aparece no log da agenda |
| `times.js` | Compara nomes de times de fontes diferentes |
| `mensagem.js` | Filtros e versão em texto (formato WhatsApp) |
| `imagem.js` | Layout e geração das imagens PNG |
| `pagina.js` | Página com links do Google Agenda e arquivo `.ics` |
| `bot.js` | Bot do Telegram que transforma o post de gol em GIF com legenda |
| `gols.js` | Lê o título do post do r/soccer ou r/futebol, acha o jogo na agenda e monta a legenda |
| `telegram.js` | Manda as imagens da agenda pro Telegram |
| `goalszone.js` | Busca automática dos gols no goals.zone |
| `rfutebol.js` | Busca automática dos gols no r/futebol (etiqueta Lances) |
| `reddit.js` | Acesso oficial ao Reddit (OAuth), usado quando há as chaves `REDDIT_CLIENT_*` |
| `gif.js` | Baixa o vídeo do link e converte em GIF (ffmpeg) |
| `avisos.js` | Avisos de início de jogo |
| `canais.js` | Link de cada canal de transmissão |
| `bot.sh` | Deixa o bot ligado no Mac (launchd) |
| `.github/workflows/bot.yml` | Turnos do bot no GitHub Actions |
| `.github/workflows/agenda.yml` | Agendamento diário, release e GitHub Pages |
| `agendar.sh` | Alternativa: agendar no próprio Mac (launchd). Fica desligado |
| `enviar.js` | Alternativa: envio automático pra um grupo de WhatsApp (whatsapp-web.js, não oficial). Fica desligado |

---

## Observações

- **Origem dos dados:** os dados vêm do futnatv.net e, no futebol, também do feed do oGol (que cobre só ~30 h à frente e não diz o campeonato: jogo que só o oGol tem aparece como "Futebol"). Se o site mudar a API, a busca pode parar de funcionar, e o erro aparece na aba **Actions**.
- **Atraso:** o GitHub pode atrasar alguns minutos o horário agendado.
- **Duração dos eventos:** a duração dos jogos na agenda é estimada (futebol e vôlei 2h, basquete 2h30, NFL 3h30).
