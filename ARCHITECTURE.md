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

Bug corrigido: diferente do balão (`focusable: false`, nunca disputa o
topo da pilha), o menu precisa ser focável pra receber clique — e assim
que abre, vira a janela mais no topo entre as de nível `'screen-saver'`.
Se o sol se movesse depois (arraste ou quique de arremesso com o menu
aberto) e passasse por cima da área do menu, ficava visualmente por
baixo dele, escondido. `repositionFollowerWindows()` agora também chama
`win.moveTop()` nesse caso — só reordena a pilha, não tira o foco do
menu — trazendo o sol de volta pro topo sempre que ele (ou um dos
popups) se move.

### Balão (`speech.html`)

O renderer do sol decide o texto (dica sorteada, fase da respiração) e manda
por IPC (`speech-show` / `speech-update` / `speech-hide`); o main cria a
janela, o balão mede o próprio tamanho (`speech-size`) e o main o posiciona
em volta do sol (`computeSpeechPlacement`): acima dele; abaixo, se não há
espaço em cima; deslocado pro lado quando o sol está na borda, com a
"pontinha" sempre apontando pro sol. O sol nunca se move pra abrir espaço.

Enquanto o balão de dica está na tela (`shining`), um `#mouth` — um óvalo
pequeno, filho de `#sun`, posicionado por cima da boca do emoji 🌞 — abre
e fecha rápido (`mouth-talk`) simulando fala; fica com `opacity:0` no
resto do tempo, deixando o sorriso normal do emoji por baixo.

O balão tem uma cor própria por tipo de dica — identidade visual, não só
texto: `kind: 'tip'` (dica de acalmar) fica no âmbar padrão,
`kind: 'physical'` (pausa física: água/alongar) fica verde-água
(`.speech-card.physical`, mesmo layout do `.tip`, só a paleta muda). O
`kind` chega do renderer do sol (`showBubble()`, a partir do parâmetro
`kind` já usado pra escolher o pool de mensagens).

No menu (`context-menu.js`), as opções de estado persistente (dicas,
caminhada, sons, iniciar com o Windows) usam um indicador quadrado
(`.toggle-dot`, preenchido e com "check" quando ativo) em vez de só trocar
o texto do verbo — dá pra ver o estado atual de cara, sem precisar ler.

Óculos escuros (`#sunglasses`, um SVG de dois lados/ponte, filho de
`#sun` — acompanha sozinho qualquer bob/talk/wobble que o sol já tiver,
sem reaplicar animação num elemento irmão): `settings.sunglasses`
(persistido), alternado pelo botão só-ícone (🕶️, estilo `.lang-btn`
reaproveitado) no menu, ação `toggle-sunglasses`. Desligado durante o
modo lua/eclipse (não faz sentido nesse estado). Formato Wayfarer
(lentes trapezoidais, mais largas em cima, com ponte e hastes grossas) —
o "estilo Ray-Ban" clássico, pedido explicitamente.

A boca (`#mouth`) precisou de alguns ajustes depois de ver rodando: larga
o bastante (27px) pra cobrir o sorriso inteiro do emoji por baixo (senão
sobrava um pedaço do sorriso original ao lado da boca falando, os dois
juntos, esquisito) e uma abertura mais contida (`scaleY` de pico 1.5, era
2.2 — estava exagerada). Também só fala com `:not(.weee):not(.weee-mild)
:not(.dizzy)` — falar E balançar de arraste/arremesso ao mesmo tempo
interferia visualmente um no outro.

`settings.sunglasses` tem `false` como padrão de verdade — nasce
desligado numa instalação nova.

### Retorno visual ao buscar atualização

`#sun-wrap.checking-update` liga o mesmo `#glow` de outros estados, com
os raios girando rápido (1,2s, bem mais rápido que qualquer outro
estado) — um "buscando" visível, já que a checagem quase sempre não
mostra popup nenhum (só quando acha uma atualização de verdade ou
quando é pedido manual e falha). `setCheckingUpdate()` (`main.js`) liga
isso a partir do evento `checking-for-update` do `autoUpdater` de
verdade (só existe com o app empacotado) e desliga nos outros eventos
(`update-downloaded`, `update-not-available`, `error`). Em modo
desenvolvimento não tem `autoUpdater` de verdade pra escutar
(`initAutoUpdater()` nem roda), então `checkForUpdatesNow()` simula: liga
`checking-update` na hora, espera 1,6s e desliga antes de mostrar o
popup de "modo desenvolvimento" — dá pra validar a animação sem precisar
de uma versão instalada de verdade.

### Modo respiração: transformação sol/lua

Classes no `#sun-wrap`: `moon-mode` (a lua 🌚 surge pequena no centro e
cresce até o tamanho normal com um bounce no final — `@keyframes
grow-in-bounce` — enquanto o sol encolhe e some no mesmo lugar
— `@keyframes shrink-out`), `breathing` (a lua, já assentada, infla/esvazia
em ciclos de 16s) e `moon-exit` (o mesmo movimento com os papéis
trocados: o sol surge pequeno e cresce com o bounce — `grow-in-bounce` —
enquanto a lua encolhe e some — `shrink-out`). Sem órbita nem rotação: é
só um crossfade com scale, então as duas `@keyframes` servem pra qualquer
um dos dois lados da transição, só trocando qual elemento recebe qual.
Nesse instante a lua escurece um pouco (`filter: brightness(0.8)` em
`#sun-wrap.breathing #moon`), simulando a sombra do eclipse.

As duas `@keyframes` são **sequenciais, não simultâneas**: quem está
desaparecendo segura o tamanho cheio até 45% e só aí encolhe rápido até
sumir aos 50%; quem está aparecendo fica escondido até esses mesmos 50%
e só depois cresce com o bounce. Bug corrigido: com as duas rodando ao
mesmo tempo o 1,8s inteiro (crossfade "de verdade"), no meio da transição
dava pra ver os raios do sol (silhueta pontuda, maior que o disco)
espiando por trás da lua (redonda, menor naquele instante) — encolher e
crescer em sequência, sem sobreposição, elimina isso de vez.

Duração total: 0,7s (era 1,8s — achatado bastante pra transição parecer
quase instantânea, não uma animação demorada). `BREATHING_EXIT_ANIM_MS`
(`main.js`) e o `setTimeout` local que tira a classe `moon-exit`
(`renderer.js`) andam junto com esse valor.

O `#glow` (mesmo brilho de "dando uma dica") também liga enquanto a lua
está por perto (`moon-mode`/`breathing`), mas vira uma coroa bem mais
colada na silhueta da lua: menor (76px em vez de 100px) e **sem os raios
girando** (`#rays { opacity: 0 }` nesses estados) — só o anel de brilho
(`#glow-circle`) pulsando. Ao voltar pro sol (`moon-exit`) o brilho fica
desligado — o sol reaparece sozinho, sem coroa atrás. Os cliques são
ouvidos no `#sun-wrap`, não no `#sun`, pra funcionarem também sobre a lua.

Bug corrigido: o `<svg>` do `#glow` corta o próprio desenho na borda do seu
`viewBox` por padrão (comportamento do navegador); o pulso do círculo de
brilho (`glow-pulse`) passa um pouco dela no pico da escala, cortando uma
fatia do brilho — corrigido com `overflow: visible` no `#glow`.

Ao terminar (por clique ou pelo tempo acabar), em vez de retomar a
caminhada na hora, o main manda `breathing-done-prompt` e o renderer
mostra um convite no balão ("Como você está? / toque para respirar de
novo", com o texto do convite em destaque — `.speech-card.cta #hint`,
diferente do texto discreto de "toque para parar" do exercício em si).
Tocando nele (`breathing-again-request`), o exercício recomeça do zero
(nova contagem regressiva); se ninguém tocar em `BREATHING_PROMPT_MS`
(7s), o renderer mesmo manda `breathing-prompt-dismissed` e só aí o main
retoma a caminhada e mostra a dica pendente, se houver. `requestTipNow()`
(pedir uma dica agora, inclusive durante o exercício) pula esse convite
de propósito — a intenção ali é ver a dica, não repetir a respiração.

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

Pedir uma dica pelo menu ("Me dá uma dica agora") enquanto está no modo
respiração não espera o exercício acabar sozinho: `requestTipNow()` chama
`endBreathingExercise(false)` — o `false` pula o convite de repetir (ver
acima) — e a dica só aparece depois que a transição termina
(`endBreathingExercise` segura o próximo passo atrás de um `setTimeout` de
`BREATHING_EXIT_ANIM_MS`, igual à duração do `grow-in-bounce`/`shrink-out`
em `renderer/style.css`, pra não cortar a animação mostrando o balão em
cima dela).

### Dois ciclos de dica independentes

`scheduleNextTip()` (dicas de acalmar, frequência configurável pelo menu) e
`scheduleNextPhysicalTip()` (água/esticar/levantar, frequência fixa em
`PHYSICAL_TIP_MINUTES`) rodam em paralelo, cada um com seu próprio timer e
jitter. Os dois passam pelo mesmo `triggerBubble(kind)` /
`isBusy()` / `pendingTip`, então nunca aparecem um por cima do outro.

Com as dicas pausadas (`settings.tipsPaused`), `triggerBubble()` retorna
na hora — clicar no sol nesse estado pedia uma dica que nunca aparecia,
sem bolha nenhuma pra tocar o barulhinho de sempre (`playChime()` vive
dentro de `showBubble()`, só dispara quando a bolha realmente aparece).
O clique ficava mudo. Corrigido tocando o chime direto no clique
(`renderer.js`) quando `tipsPaused` está ligado — o renderer passa a
acompanhar esse valor via `init-settings` e um novo evento
`tips-paused-changed` (enviado pelo main só quando o menu alterna a
opção). Fora desse caso, quem toca o som continua sendo `showBubble()`
como sempre, pra não duplicar.

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
  A reta final tem um freio mais forte (`FLING_EASE_SPEED` /
  `FLING_EASE_FRICTION`) do que o atrito normal do "cruzeiro": sem isso,
  o atrito fraco de sempre levava muito tempo pra chegar perto de zero, e
  o corte em `FLING_STOP_SPEED` acontecia com o sol ainda visivelmente em
  movimento — um "easy out" suave em ~0,5s em vez de um travão seco.
  Sendo arrastado (depois de já ter se movido) é sempre a empolgação
  máxima; voando livre depois do arremesso, a empolgação tem graus
  conforme a velocidade atual (`main.js` manda `fling-speed` a cada tick
  do `flingTick()`, não só no início): acima de `FLING_WILD_SPEED` (260
  px/s) é `#sun-wrap.weee` — cara de "weeeee" (😆) e balanço rápido
  (`weee-wobble`); abaixo disso (mas ainda em movimento) é
  `#sun-wrap.weee-mild` — mesma cara normal, só um balanço bem mais
  discreto e devagar (`weee-wobble-mild`); abaixo de `FLING_CALM_SPEED`
  (40 px/s, "quase parando") nenhuma das duas classes liga mais — a
  animação de idle/caminhada por baixo (nunca desligada) volta a aparecer
  sozinha, então a transição pro estado normal já acontece antes do
  arremesso terminar de verdade, não só no instante exato em que ele para.
  Em qualquer um dos dois graus de empolgação, o `#glow` (mesmo brilho de
  outros estados) liga com um pulso bem sutil (encolhe um pouco e volta) e
  os raios giram bem mais devagar que em qualquer outro estado (26s no
  "weee", 40s no "weee-mild"). No instante exato de bater numa borda,
  `#sun-wrap.dizzy` sobrepõe brevemente uma cara de tonto (😵) e um balanço
  mais brusco (`fling-wobble`, reaproveitado do design anterior) por cima
  do que estava tocando — dura o mesmo tanto que o squash do impacto
  (`animationend` de `wall-squash-x/y` desliga o `dizzy`) e depois volta
  sozinho pro grau de empolgação correspondente à velocidade atual, já que
  o voo continua. `updateMotionVisual()` (em `renderer.js`) centraliza essa
  troca de cara/classe a partir de `isDragging`, `flingActive`,
  `flingSpeed` e `impactActive`, sempre mutuamente exclusivos entre si.

  Bug corrigido: a troca de cara usava `sunEl.textContent = ...`, que
  **apaga todos os filhos** do `#sun` — inofensivo enquanto ele só tinha
  texto, mas destruía os `#mouth`/`#sunglasses` (adicionados depois) toda
  vez que a cara mudava (todo tick de arremesso!). Resolvido movendo o
  emoji do rosto pra um `<span id="face">` próprio, filho de `#sun` junto
  com os outros — só o `.textContent` desse span é trocado agora.

  Ao parar de se mexer (arraste solto sem virar arremesso, ou arremesso
  decaindo até "calmo"), uma classe `.settling` (`@keyframes
  settle-wobble`, 0,4s, `animation-fill-mode: forwards`) assenta a
  rotação de volta a zero antes de devolver o controle pra animação de
  idle/caminhada por baixo (nunca desligada) — sem isso, o corte era
  seco: `rotate()` do wobble não interpola com o `translateY`/`scale()`
  do `bob`/`breathe`, então a única saída visual era um "sumiço" abrupto.
  `wasMoving` (em `renderer.js`) guarda a borda de descida
  (estava-se-mexendo → parou) pra disparar isso só nesse instante exato;
  se um novo movimento começar antes dela terminar, `.settling` é
  cancelada na hora (senão ganharia do `weee`/`weee-mild` por vir depois
  no arquivo).
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

Todo som do app é sintetizado na hora com a Web Audio API (osciladores
simples), nenhum arquivo de áudio — evita ter que embutir/licenciar um
asset de som. Os quatro (`playChime` da dica, `playBounceThud` da batida
na parede, `playMoonToSunChime` da lua virando sol, `playMenuPop` do
botão direito) têm o mesmo "ar" cozy de propósito, através de duas peças
compartilhadas em `renderer.js`:

- `warmDestination(ctx, cutoff)` — um `BiquadFilter` passa-baixa por onde
  todo som passa antes do alto-falante. Onda triangular sozinha tem
  harmônicos agudos que soam "sintético"; o filtro tira essa aspereza.
- `playWarmNote(ctx, dest, freq, opts)` — uma nota = triangle (corpo) +
  sine uma oitava acima bem baixinho (brilho suave), os dois passando
  pelo `warmDestination`. Usada pelo chime da dica, o toque de "marimba"
  da batida (nota sorteada entre G4/A4/B4/C5, tipo sino de vento) e o
  puf de transformação — cada um só muda frequência/duração/volume.

O `playMenuPop` fica de fora do `playWarmNote` de propósito: é pra ser
curto e discreto (pedido explícito — "bem sutil e seco"), então é só um
osc/gain direto, mas ainda passando pelo mesmo `warmDestination` pra não
destoar dos outros três.

O volume do toque da batida (não o tom) escala com a força do impacto
(`speed` mandado por `flingTick`). `settings.muted` (menu → 🔇/🔊) desliga
os quatro; a troca é avisada na hora por `mute-changed`, igual ao idioma.

## Atualização automática (`electron-updater`)

`initAutoUpdater()` só roda com `app.isPackaged` (a versão instalada) —
em `npm start` não tem feed de update nenhum pra checar, e tentar checar
sem isso só geraria erro. Ao abrir, espera 15s (não atrapalhar a
inicialização) e checa uma vez; o resto do ciclo de vida é
"instale sozinho": `autoDownload` e `autoInstallOnAppQuit` ficam ligados,
então se o usuário não clicar em nada, a atualização baixa em segundo
plano e instala na próxima vez que o app fechar normalmente.

O popup (`renderer/update-prompt.html`, mesmo padrão de janela das outras
janelas secundárias — nasce ao aparecer, morre ao fechar, ancorada acima
do sol) só aparece em duas situações: quando o download termina
(`update-downloaded`, sempre, com botões "Atualizar agora" / "Depois") ou
quando a checagem foi manual (menu → "Buscar atualização") e não achou
nada de novo, achou o mesmo de sempre um erro, ou rodou fora do app
instalado — a flag `manualUpdateCheck` é o que distingue "checagem
silenciosa que não achou nada" (não avisa) de "a pessoa pediu pra checar"
(sempre avisa alguma coisa, mesmo que seja "já está atualizado").

O feed de atualização é o Releases do próprio repositório GitHub
(`build.publish` em `package.json`, provider `github`) — não tem
servidor próprio nem infraestrutura extra. Ver [README.md](README.md)
pra como publicar uma versão nova (`npm run release`, precisa de
`GH_TOKEN`).

## Relatar um bug

"🐛 Relatar um bug" no menu (`reportBug()` em `main.js`) não manda nada
sozinho — monta o link de uma issue nova no GitHub já preenchida
(versão do app via `app.getVersion()`, SO, idioma) e abre no navegador
padrão com `shell.openExternal()`; quem relata ainda revisa e clica em
"Submit" lá.

## Iniciar com o Windows

`registerAutoLaunch()` só faz efeito na versão instalada (`app.isPackaged`
— em modo dev, `process.execPath` aponta pro `electron.exe` do
`node_modules`, não pro app de verdade, e registrar isso na inicialização
do Windows não faria sentido nenhum). O valor em si (`settings.autoLaunch`,
`true` por padrão) é lido e salvo normalmente também em dev — só o
`app.setLoginItemSettings()` de fato é pulado. O menu chama
`registerAutoLaunch()` de novo a cada troca, pra aplicar na hora.

## Ícone

`build/icon.png` (1024×1024, fundo transparente) é o próprio emoji 🌞
desenhado num `<canvas>` e exportado via `toDataURL()` — não é um asset
de terceiros, é gerado a partir do mesmo emoji que o app usa. Serve pra
duas coisas: o `electron-builder` converte ele automaticamente pro `.ico`
do instalador/atalhos (`build.win.icon` em `package.json`; é assim que
o ícone aparece no `.exe`, no menu iniciar e na área de trabalho), e a
janela do sol usa o mesmo arquivo direto (`icon:` no `BrowserWindow`) pra
ficar consistente também em modo desenvolvimento (Alt+Tab, gerenciador de
tarefas) — mesmo com `skipTaskbar: true` não aparecendo na barra de
tarefas normalmente.

Um detalhe de exportar via `<canvas>` em vez de `capturePage()`: a
segunda não preserva transparência (devolve fundo branco sólido mesmo
com a janela `transparent: true`), o canvas sim.

## Scripts npm

- `npm start` — roda em modo desenvolvimento (`electron .`)
- `npm run pack` — build sem instalador, só a pasta descompactada
  (`dist/win-unpacked/`), útil pra testar rápido
- `npm run build` — gera o instalador Windows (`dist/Solzinho Setup *.exe`),
  sem publicar
- `npm run release` — gera o instalador e publica como Release no GitHub
  (precisa de `GH_TOKEN`); é isso que os usuários instalados recebem
  como atualização
