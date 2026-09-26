# Arquitetura

Electron puro (sem framework de UI), com múltiplas `BrowserWindow`
transparentes e sem moldura — cada uma é uma peça visual separada, não uma
"aba" de uma única janela.

## Janelas

| Janela | Arquivo | Quando existe |
|---|---|---|
| Sol (principal) | `renderer/index.html` | Sempre; contém o sol, a bolha de dica e o painel de respiração |
| Menu (botão direito) | `renderer/context-menu.html` | Enquanto o menu está aberto |
| Frequência personalizada | `renderer/frequency-prompt.html` | Enquanto essa janela está aberta |

Todas usam `transparent: true`, `frame: false`, `alwaysOnTop: true` (nível
`screen-saver`, o mais alto do Electron) e `skipTaskbar: true`. A janela do
sol é `focusable: false` de propósito — ela nunca deve roubar foco de outra
janela; por isso o arraste é feito manualmente (veja abaixo), não com
`-webkit-app-region: drag` nativo (que quebra clique/menu de contexto — ver
CHANGELOG).

## Processo principal (`main.js`)

Dono de todo o estado: posição do sol, configurações (`settings.json` em
`app.getPath('userData')`), e todos os timers. Os renderers não guardam
estado que sobrevive a um reload — só main.js.

### Ancoragem das janelas secundárias

O menu e a janela de frequência não são posicionados na tela toda; eles são
calculados a partir da posição atual do sol (`computeMenuPosition`,
`computeFreqPromptPosition`, em `main.js`), e se o sol for arrastado
enquanto uma delas está aberta, `repositionFollowerWindows()` os realinha
em tempo real.

Ponto de atenção: a janela do sol (`WIN_H = 320`) é bem maior que o sol
visível (`96px` de altura, ancorado no rodapé da janela) — ela precisa desse
espaço extra pra caber a bolha de dica crescendo pra cima sem cortar. Por
isso existe `SUN_VISUAL_TOP_MARGIN` / `getSunAnchorTop()`: sem isso, quem
ancora no sol acaba ancorando no topo da janela invisível, bem acima de
onde o sol realmente está.

### Motivos de pausa da caminhada (`pauseReasons`)

A caminhada do sol pode ser pausada por vários motivos ao mesmo tempo:
mostrando uma dica, ciclo de "parada pra respirar" aleatório, exercício de
respiração, menu aberto, janela de frequência aberta. Isso é modelado como
um `Set` de motivos (`pauseWalk(reason)` / `resumeWalk(reason)`), não um
booleano único — um booleano único já causou um bug real (o ciclo de idle
"destravava" a caminhada mesmo com um popup ainda aberto, porque os dois
mexiam na mesma variável). Andar só é permitido quando o `Set` está vazio.

### Dica pendente (`pendingTip`)

Se a hora de mostrar uma dica chega enquanto o app está "ocupado" (menu ou
popup aberto, ou exercício de respiração rolando — ver `isBusy()`), a dica
não aparece atrás do popup; ela fica guardada em `pendingTip` (guarda só
**uma**, nunca acumula) e é mostrada assim que o que estava ocupando a tela
terminar (`showPendingTipIfAny()`, chamado nos handlers de fechamento de
cada popup e no fim do exercício de respiração).

### Dois ciclos de dica independentes

`scheduleNextTip()` (dicas de acalmar, frequência configurável pelo menu) e
`scheduleNextPhysicalTip()` (água/esticar/levantar, frequência fixa em
`PHYSICAL_TIP_MINUTES`) rodam em paralelo, cada um com seu próprio timer e
jitter. Os dois passam pelo mesmo `triggerBubble(kind)` /
`isBusy()` / `pendingTip`, então nunca aparecem um por cima do outro.

## Arraste manual (não usa `-webkit-app-region: drag`)

O sol começou usando a região de drag nativa do Chromium, mas isso faz o
Windows tratar aquela área como barra de título — clique normal e botão
direito param de funcionar (o SO intercepta o mousedown antes do DOM).
A solução final: o renderer só avisa início (`mousedown`) e fim
(`mouseup`) do arraste; enquanto dura, o main process lê o cursor com
`screen.getCursorScreenPoint()` a cada 16ms e move a janela.

Por que o cursor é lido no main e não no renderer: com monitores de escalas
diferentes (ex.: 100% e 150%), o `screenX`/`screenY` do renderer fica em
outro sistema de coordenadas ao cruzar de tela, e o arraste travava.
Pelo mesmo motivo, o renderer encerra o arraste se receber `mousemove` com
nenhum botão pressionado — o `mouseup` pode se perder na troca de tela.

## Onde a janela do sol aceita clique

A janela do sol deixa o mouse atravessar (`setIgnoreMouseEvents(true)`),
exceto sobre o sol e sobre o balão/painel de respiração quando visíveis.
Quem decide é `hoverTick()` no main, a cada 50ms, comparando
`screen.getCursorScreenPoint()` com essas áreas (o renderer informa onde
estão balão e painel via `set-interactive-rects`).

A versão anterior usava `mouseenter`/`mouseleave` no renderer, que dependem
do repasse de mouse do Windows (`forward: true`). Em monitor com escala !=
100% esse repasse informa a posição errada, o sol nunca "percebia" o mouse
em cima e ficava impossível de clicar/arrastar depois de mudar de tela.

## Posição do sol e múltiplos monitores

A posição da janela do sol é guardada em `sunPos` (com casas decimais) e
aplicada por `setSunBounds()`, em vez de relida com `getBounds()` a cada
passo: num monitor com escala != 100% o Windows arredonda a posição e um
passo de ~1px some — o sol "andava" sem sair do lugar. `setSunBounds()`
também corrige o tamanho da janela, que o Windows pode alterar ao cruzar
para um monitor de outra escala.

Nada é fixo para um setup específico: todos os limites vêm de
`screen.getAllDisplays()` / `getDisplayNearestPoint()`, então funciona
com quantos monitores a pessoa tiver, em qualquer escala e arranjo.

- **Caminhada**: atravessa todos os monitores (vai da borda esquerda do
  monitor mais à esquerda até a direita do mais à direita). Ao entrar num
  monitor mais alto ou mais baixo, o sol se ajusta pra ficar dentro dele;
  se vinha no "chão" da tela anterior, continua no chão da nova.
- **Arraste**: pode ir pra qualquer monitor, travado no monitor onde o sol
  vai ficar.
- **Monitor conectado/desconectado ou mudança de resolução/escala** com o
  app aberto: `keepSunOnScreen()` traz o sol de volta pro monitor mais
  próximo.

O limite de tela (`clampSunWindowPosition`) é aplicado ao **sol visível**,
não à janela: a janela tem ~80px invisíveis de cada lado e ~210px em cima
(espaço do balão), então travar a janela deixava um vão até a borda real.
A parte invisível pode sair da tela; o sol nunca sai. A barra de tarefas
é sempre respeitada (usa-se `workArea`, não `bounds`).

Consequência: com o sol encostado numa borda, a área do balão fica fora da
tela. Por isso `ensureBubbleRoom()` traz a janela inteira pra dentro da tela
antes de mostrar uma dica ou o exercício de respiração (o sol "dá um passo
pra dentro" pra falar).

## Idioma (i18n)

`renderer/i18n.js` é um dicionário simples `{ pt: {...}, en: {...} }`
carregado por qualquer janela que precise de texto de interface (índice
principal, menu, janela de frequência). As mensagens de dica em si vivem
em `renderer/messages.js`, também por idioma (`MESSAGES.pt` /
`MESSAGES.en`, `PHYSICAL_MESSAGES.pt` / `.en`). Trocar o idioma pelo menu
salva em `settings.language` e manda `language-changed` pra janela
principal atualizar na hora — não precisa reiniciar o app.

## Som

O "tin-tin-tin" que toca quando uma dica aparece é sintetizado na hora com
a Web Audio API (osciladores simples), não é um arquivo de áudio — evita
ter que embutir/licenciar um asset de som.

## Scripts npm

- `npm start` — roda em modo desenvolvimento (`electron .`)
- `npm run pack` — build sem instalador, só a pasta descompactada
  (`dist/win-unpacked/`), útil pra testar rápido
- `npm run build` — gera o instalador Windows (`dist/Solzinho Setup *.exe`)
