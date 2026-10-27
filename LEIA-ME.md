# Agenda esportiva do dia

Todo dia às 8h (Brasília) o GitHub Actions busca os jogos (futebol, basquete, vôlei e NFL) em futnatv.net, gera as imagens da agenda e publica numa **release do dia**. Não precisa do Mac ligado.

## Onde pegar as imagens

https://github.com/o-bom-redator/agenda-esportiva/releases

Cada dia tem uma release "Agenda DD/MM" com:
- `jogos-AAAA-MM-DD-1.png`, `-2.png`...: a agenda em imagem (divide quando tem muitos jogos).
- `mensagem.txt`: a mesma agenda em texto.

As releases com mais de 10 dias são apagadas sozinhas. O GitHub avisa por e-mail e no app quando sai uma release nova (se não chegar, em **Watch → Custom → Releases** no repositório).

## Gerar fora do horário

- No GitHub: **Actions → Agenda do dia → Run workflow** e escolha `hoje`, `amanha` ou uma data (`2026-10-28`).
- No Mac: `node gerar.js --data amanha`. Salva em `imagens/AAAA-MM-DD/` e abre a pasta.

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
