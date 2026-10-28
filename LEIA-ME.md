# Agenda esportiva do dia

Todo dia às 5h (Brasília) o GitHub Actions busca os jogos (futebol, basquete, vôlei e NFL) em futnatv.net, gera as imagens da agenda e publica numa **release do dia**. Não precisa do Mac ligado.

## Onde pegar as imagens

https://github.com/o-bom-redator/agenda-esportiva/releases

Cada dia tem uma release "Agenda DD/MM" com:
- `jogos-AAAA-MM-DD-1.png`, `-2.png`...: a agenda em imagem (divide quando tem muitos jogos).
- `mensagem.txt`: a mesma agenda em texto.

As releases de dias que já passaram são apagadas sozinhas (só fica a do dia). O GitHub avisa por e-mail e no app quando sai uma release nova (se não chegar, em **Watch → Custom → Releases** no repositório).

## Página com "Salvar na agenda"

Cada execução também gera uma página (`site/index.html`) em que cada jogo tem um botão que abre o Google Agenda já preenchido (horário, campeonato e onde assistir), mais um filtro por esporte e o arquivo `agenda.ics` com todos os jogos (iPhone/Outlook).

Ela é publicada no GitHub Pages quando o Pages está ligado no repositório (Settings → Pages → Source: GitHub Actions). No plano grátis do GitHub, o Pages só funciona em repositório público. Enquanto estiver desligado, o passo é pulado sem erro.

## Gerar fora do horário

- No GitHub: **Actions → Agenda do dia → Run workflow** e escolha `hoje`, `amanha` ou uma data (`2026-10-28`).
- No Mac: `node gerar.js --data amanha`. Salva em `imagens/AAAA-MM-DD/` (e a página em `site/`) e abre a pasta.

## Opções (`config.json`)

Depois de alterar, faça commit e push pro GitHub usar a versão nova.

- `esportes`: quais esportes entram: `futebol`, `basquete`, `volei`, `nfl`.
- `ocultarBase`: `true` tira jogos sub-17, sub-20, U21, juniores etc.
- `ocultarFemininos`: `true` tira jogos femininos.
- `ocultarCampeonatos`: ex. `["MLS", "Campeonato Saudita"]`.
- `jogosPorImagem`: acima disso, divide em mais de uma imagem (padrão 22).

## Outras opções guardadas

- `./agendar.sh`: agenda a geração no próprio Mac às 8h (desligado; o GitHub faz isso agora).
- `enviar.js`: envio automático pro grupo do WhatsApp (desligado). Veja os comentários no topo do arquivo.
