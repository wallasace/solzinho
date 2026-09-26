# Arquitetura

Electron puro (sem framework de UI), com múltiplas `BrowserWindow`
transparentes e sem moldura — cada uma é uma peça visual separada, não uma
"aba" de uma única janela.

## Janelas

| Janela | Arquivo | Quando existe |
|---|---|---|
| Sol (principal) | `renderer/index.html` | Sempre; contém o sol (e a lua do modo respiração) |
| Balão | `renderer/speech.html` | Enquanto há dica ou exercício de respiração na tela |
| Menu (botão direito) | `renderer/context-menu.html` | Enquanto o menu está aberto |
| Frequência personalizada | `renderer/frequency-prompt.html` | Enquanto essa janela está aberta |

As janelas secundárias (balão, menu, frequência) são **criadas ao abrir e
destruídas ao fechar**, sempre já no monitor do sol — nascer direto no
monitor certo evita o bug do Electron de perder clique ao trocar de monitor
(ver abaixo). Cada uma só mexe no estado global (`menuWin`, `speechWin`...)
se ainda for a janela atual: antes, o `closed` assíncrono de um menu antigo
apagava a referência do menu novo, que ficava órfão e o menu parava de abrir.

### Balão (`speech.html`)

O renderer do sol decide o texto (dica sorteada, fase da respiração) e manda
por IPC (`speech-show` / `speech-update` / `speech-hide`); o main cria a
janela, o balão mede o próprio tamanho (`speech-size`) e o main o posiciona
em volta do sol (`computeSpeechPlacement`): acima dele; abaixo, se não há
espaço em cima; deslocado pro lado quando o sol está na borda, com a
"pontinha" sempre apontando pro sol. O sol nunca se move pra abrir espaço.

### Modo respiração: eclipse

Classes no `#sun-wrap`: `moon-mode` (a lua 🌚 entra pequena e por trás do
sol, dá a volta por cima como uma órbita e desce na frente crescendo até
cobrir o sol exatamente — durante a contagem regressiva), `breathing` (a
lua, já em eclipse, infla/esvazia em ciclos de 16s) e `moon-exit` (a mesma
órbita de trás pra frente, usando `animation-direction: reverse` na mesma
`@keyframes eclipse-orbit` — não há uma segunda animação escrita pra
volta). O sol (`@keyframes eclipse-sun`) fica com opacidade cheia durante
toda a órbita e só é encoberto nos ~30% finais, quando a lua já está na
frente e do mesmo tamanho. O `#glow` (raios + brilho que já existia pra
"dando uma dica") também liga durante o eclipse — vira a coroa solar ao
redor do disco escuro da lua, girando mais devagar (14s) que no estado de
fala (6s). Os cliques são ouvidos no `#sun-wrap`, não no `#sun`, pra
funcionarem também sobre a lua.

Bug corrigido: o `<svg>` do `#glow` corta o próprio desenho na borda do seu
`viewBox` por padrão (comportamento do navegador); o pulso do círculo de
brilho (`glow-pulse`) passa um pouco dela no pico da escala, cortando uma
fatia do brilho — corrigido com `overflow: visible` no `#glow`.

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
visível (`96px` de altura, ancorado no rodapé da janela) — herança de
quando o balão morava nela. Por isso existe `SUN_VISUAL_TOP_MARGIN` /
`getSunAnchorTop()` / `sunVisualRect()`: sem isso, quem
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
exceto sobre o sol. Quem decide é `hoverTick()` no main, a cada 50ms,
comparando `screen.getCursorScreenPoint()` com `sunVisualRect()`.

A versão anterior usava `mouseenter`/`mouseleave` no renderer, que dependem
do repasse de mouse do Windows (`forward: true`). Em monitor com escala !=
100% esse repasse informa a posição errada, o sol nunca "percebia" o mouse
em cima e ficava impossível de clicar/arrastar depois de mudar de tela.

### Bug do Electron ao trocar de monitor com escala diferente

Uma janela criada num monitor de 100% e levada (com `setBounds`) para um
de 150% passa a **perder o `mousedown`**: o `mouseup` chega, o `mousedown`
não, então o arraste nunca começa. Janela criada direto no monitor de 150%
não tem o problema, e janelas pequenas (120×120) também não — com o
tamanho da do sol (260×320) acontece sempre. Não é o cálculo de posição:
foi medido com `GetWindowRect` e com print da tela, e janela, desenho e
área clicável estavam todos no lugar certo.

O que resolve: um redimensionamento de verdade (1px maior e volta), ou
esconder e mostrar a janela. Usamos o redimensionamento, que não pisca:
`setSunBounds()` detecta quando a janela muda de monitor e, assim que
não estiver mais sendo arrastada, chama `refreshInputAfterDisplayChange()`.

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

- **Caminhada**: fica no monitor onde o sol está (de borda a borda dele);
  nunca troca de tela sozinha.
- **Arraste**: é o único jeito de mudar de monitor; pode ir pra qualquer
  um, travado no monitor onde o sol vai ficar.
- **Arremesso**: soltar o sol em movimento rápido continua o movimento
  (`startFlingIfFast` / `flingTick`, em `main.js`) — atrito a cada tick,
  quique nas bordas do monitor atual (perde parte da velocidade), até
  parar sozinho e a caminhada normal retomar. A velocidade é estimada em
  `dragTick()` comparando a posição a cada 16ms, suavizada entre ticks pra
  não ficar nervosa. Arrastar de novo no meio do arremesso cancela ele.
- **Monitor conectado/desconectado ou mudança de resolução/escala** com o
  app aberto: `keepSunOnScreen()` traz o sol de volta pro monitor mais
  próximo.

O limite de tela (`clampSunWindowPosition`) é aplicado ao **sol visível**,
não à janela: a janela tem ~80px invisíveis de cada lado e ~210px em cima
(espaço do balão), então travar a janela deixava um vão até a borda real.
A parte invisível pode sair da tela; o sol nunca sai. A barra de tarefas
é sempre respeitada (usa-se `workArea`, não `bounds`). O balão, por ter
janela própria, se ajusta à borda sozinho — o sol não se move pra falar.

## Idioma (i18n)

`renderer/i18n.js` é um dicionário simples `{ pt: {...}, en: {...} }`
carregado por qualquer janela que precise de texto de interface (índice
principal, menu, janela de frequência). As mensagens de dica em si vivem
em `renderer/messages.js`, também por idioma (`MESSAGES.pt` /
`MESSAGES.en`, `PHYSICAL_MESSAGES.pt` / `.en`). Trocar o idioma pelo menu
salva em `settings.language` e manda `language-changed` pra janela
principal atualizar na hora — não precisa reiniciar o app.

## Som

O "tin-tin-tin" da dica e o "boing" do arremesso batendo na parede são
sintetizados na hora com a Web Audio API (osciladores simples), não são
arquivo de áudio — evita ter que embutir/licenciar um asset de som. O
volume do boing escala com a força do impacto (`speed` mandado por
`flingTick`). `settings.muted` (menu → 🔇/🔊) desliga os dois; a troca é
avisada na hora por `mute-changed`, igual ao idioma.

## Scripts npm

- `npm start` — roda em modo desenvolvimento (`electron .`)
- `npm run pack` — build sem instalador, só a pasta descompactada
  (`dist/win-unpacked/`), útil pra testar rápido
- `npm run build` — gera o instalador Windows (`dist/Solzinho Setup *.exe`)
