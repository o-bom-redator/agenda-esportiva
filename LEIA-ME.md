# Agenda esportiva do dia

Todo dia às 8h busca os jogos (futebol, basquete, vôlei e NFL) em futnatv.net, gera as imagens da agenda e avisa com uma notificação no Mac. A pasta do dia abre sozinha no Finder.

## Onde ficam as imagens

`imagens/AAAA-MM-DD/`, por exemplo `imagens/2026-10-28/`:
- `jogos-2026-10-28-1.png`, `-2.png`...: a agenda em imagem (divide quando tem muitos jogos).
- `mensagem.txt`: a mesma agenda em texto, pra colar se preferir.

## Comandos

- `node gerar.js`: gera agora os jogos de hoje.
- `node gerar.js --data amanha` ou `node gerar.js --data 2026-10-28`: outro dia.
- `./agendar.sh`: liga (ou atualiza) o agendamento das 8h.
- `./agendar.sh remover`: desliga o agendamento.
- `agenda.log`: histórico de cada execução.
- Mudou a pasta de lugar? Rode `./agendar.sh` de novo.

## Opções (`config.json`)

- `esportes`: quais esportes entram: `futebol`, `basquete`, `volei`, `nfl`.
- `ocultarBase`: `true` tira jogos sub-17, sub-20, U21, juniores etc.
- `ocultarFemininos`: `true` tira jogos femininos.
- `ocultarCampeonatos`: ex. `["MLS", "Campeonato Saudita"]`.
- `jogosPorImagem`: acima disso, divide em mais de uma imagem (padrão 22).
- `abrirPasta`: `false` pra não abrir o Finder, só notificar.

## Observações

- O Mac precisa estar ligado. Se estiver em repouso às 8h, gera quando acordar.
  Pra ele acordar sozinho: `sudo pmset repeat wakeorpoweron MTWRFSU 07:58:00`.
- Envio automático pelo WhatsApp (opcional, desligado): `enviar.js`. Veja os comentários no topo do arquivo.
