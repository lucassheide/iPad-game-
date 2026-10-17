# Lucas Kong

Um jogo no estilo Donkey Kong para iPad, celular e computador. O Lucas levou a Lara para o alto da obra: suba as vigas, desvie dos barris e resgate a princesa.

## Como jogar

Abra o `index.html` no navegador (Safari no iPad/iPhone, Chrome no Android ou no computador). No iPad e no iPhone, toque em **Compartilhar → Adicionar à Tela de Início** para abrir em tela cheia como um app.

- **Toque:** direcional à esquerda, botão PULAR à direita (há modo canhoto em Ajustes).
- **Teclado:** setas ou WASD + Espaço. Esc pausa.
- **Duelo no teclado:** jogador 1 com WASD + Espaço, jogador 2 com setas + Enter.
- **Gamepad:** funciona também (um por jogador no duelo).

## O que tem

- As 4 fases clássicas: **Barris (25 m)**, **Esteiras (50 m)**, **Elevadores (75 m)** e **Rebites (100 m)**. Depois de salvar a Lara, as fases voltam mais rápidas, espelhadas e com outro tema de cores (125 m, 150 m, …), sem fim.
- Martelo, itens da Lara (bolsa, chapéu, guarda-chuva), bônus no relógio, vidas extras aos 10.000 e 30.000 pontos.
- **Contas** com nome, cor do herói e PIN opcional de 4 números. Qualquer pessoa pode criar a sua.
- **Modos:** Solo, Revezamento (2 jogadores, um de cada vez) e Duelo (2 jogadores ao mesmo tempo na mesma tela).
- **Ranking** de pontuações, estatísticas por jogador e placar de disputas entre contas.
- Treino a partir de qualquer fase já alcançada (não conta para o ranking).

Quando o jogo roda como página publicada no claude.ai, contas e ranking ficam num banco compartilhado e aparecem em todos os aparelhos. Fora dele (arquivo local ou GitHub Pages) ficam salvos no próprio aparelho.

## Desenvolvimento

O código fica em `src/` e o `index.html` é gerado a partir dele:

```sh
node tools/build.mjs                                   # gera index.html e dist/artifact.html
NODE_PATH=$(npm root -g) node tools/smoke.mjs          # abre no Chromium e tira capturas de cada fase
NODE_PATH=$(npm root -g) node tools/icons.mjs          # regera os ícones
```

| Arquivo | Conteúdo |
| --- | --- |
| `src/js/01-storage.js` | Contas, pontuações e duelos (online ou local) |
| `src/js/02-audio.js` | Efeitos e músicas sintetizados (WebAudio) |
| `src/js/03-input.js` | Teclado, toque e gamepad |
| `src/js/04-art.js` | Todo o desenho vetorial (personagens, vigas, objetos) |
| `src/js/05-levels.js` | Geometria das fases e dificuldade por volta |
| `src/js/06-game.js` | Física, inimigos, pontuação e fluxo das fases |
| `src/js/07-render.js` | Renderização e HUD |
| `src/js/08-ui.js` | Menus, contas, ranking e controles de toque |
