# Changelog

Registro do que foi construído, em ordem cronológica. Este projeto não usa
versionamento semântico ainda (é uso pessoal); as entradas marcam marcos de
funcionalidade, não releases.

## Primeira versão

- Mascote de desktop em Electron: sol transparente, sempre por cima,
  andando pela parte de baixo da tela, com pausas de "respirar" aleatórias.
- Bolha de dica com mensagens baseadas em técnicas de psicologia
  (respiração, grounding 5-4-3-2-1, autocompaixão, reestruturação
  cognitiva), num ritmo configurável.
- Clique no sol pede uma dica na hora; botão direito abre menu (pausar
  dicas, frequência, parar/retomar caminhada, fechar).

## Arrastar o sol

- Primeira tentativa com `-webkit-app-region: drag` nativo quebrou clique
  e botão direito (o Windows intercepta como barra de título). Trocado por
  arraste manual via IPC (`mousedown`/`mousemove` no renderer, `setBounds`
  no main process).
- Corrigido depois: o arraste não tinha limite nenhum e dava pra perder o
  sol fora da tela — travado dentro da área útil do monitor.
- Corrigido de novo: o limite era aplicado à janela (bem maior que o sol,
  por causa do espaço do balão), então o sol parava longe da borda real.
  Agora o limite é aplicado ao sol visível, no monitor onde ele está, e o
  sol se afasta da borda só na hora de mostrar o balão.

## Visual e feedback

- Redesenho do balão de dica (estava sendo cortado pela janela) e do
  brilho ao redor do sol quando fala (SVG com raios girando + glow
  pulsante, ajustado de tamanho algumas vezes até ficar colado ao sol).
- Animação de "fala" (squash-and-stretch) enquanto a dica está na tela, no
  lugar da animação de caminhada que continuava tocando por baixo.
- Som sintetizado (Web Audio API, sem arquivo de áudio) tocando junto com
  a dica.
- Animação de entrada do balão com efeito elástico (bounce).

## Menu customizado

- Trocado o menu nativo do botão direito (estilo do Windows) por um menu
  HTML próprio, com a mesma identidade visual do balão — permitiu corrigir
  também um bug real do menu nativo (a opção "Personalizado" aparecia
  marcada assim que clicada, antes mesmo de confirmar, por comportamento
  padrão do rádio nativo do Windows).
- Frequência personalizada: janela dedicada pra digitar o intervalo em
  minutos.
- Corrigido bug de ancoragem: menu e janela de frequência estavam sendo
  posicionados a partir do topo da janela invisível do sol (bem maior, pra
  caber a bolha), não do sol visível — ficavam longe dele.
- Ambos passaram a acompanhar o sol em tempo real se ele for arrastado
  enquanto estão abertos.
- Corrigido bug de pausa: o ciclo de "parada aleatória" e a bolha de dica
  usavam a mesma variável de pausa que o menu/popup, então o ciclo de
  idle podia "destravar" a caminhada com um popup ainda aberto. Resolvido
  com múltiplos motivos de pausa independentes (`pauseReasons`).
- Barra de rolagem indevida no menu: faltava `overflow: hidden` no
  `html`/`body` dessa janela (diferente da janela principal).

## Exercício de respiração

- Novo item de menu: exercício de respiração guiada (quadrada, 4-4-4-4,
  4 ciclos), com o sol "respirando" em escala sincronizada com o texto da
  fase atual.
- Contagem regressiva de 3s ("Prepare-se…") antes do ciclo começar de
  verdade.
- Clicar no sol durante o exercício agora também o encerra (antes só
  funcionava clicando no painel de texto).
- Dicas que "quiserem" aparecer durante o exercício esperam ele terminar,
  reaproveitando o mesmo mecanismo de dica pendente.

## Dois ritmos de dica

- Separado um segundo ciclo de dicas, independente do de "acalmar":
  lembretes de pausa física (beber água, esticar, levantar), com sua
  própria frequência e conjunto de mensagens.

## Idioma

- Suporte a português e inglês em toda a interface (menu, janela de
  frequência, fases da respiração) e nas duas listas de dicas, trocável
  por duas bandeirinhas (🇧🇷/🇺🇸) no menu, sem precisar reiniciar o app.

## Empacotamento e distribuição

- `electron-builder` configurado para gerar um instalador Windows (NSIS,
  por usuário, sem precisar de admin).
- Auto-início no login do Windows via `app.setLoginItemSettings`, ativo
  apenas na versão instalada (não no modo desenvolvimento).
- Licenciado sob os mesmos termos do projeto [Meridian](https://github.com/wallasace/meridian)
  do mesmo autor: PolyForm Internal Use License 1.0.0 (source-available,
  uso pessoal/interno livre, uso comercial sob licença separada).
