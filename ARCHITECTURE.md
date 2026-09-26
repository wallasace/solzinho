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
A solução final: `mousedown`/`mousemove`/`mouseup` no renderer enviam
posição absoluta do mouse (`screenX`/`screenY`) por IPC; o main process
calcula o delta e move a janela com `setBounds`. O arraste é travado dentro
da área útil da tela (`currentWorkArea()`, que já exclui a barra de
tarefas) — sem isso, dava pra arrastar o sol pra fora da tela e "perdê-lo".

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
