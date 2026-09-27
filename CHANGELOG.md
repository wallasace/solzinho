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

## Múltiplos monitores

- Corrigido: ao arrastar pra um monitor com outra escala (ex.: 100% → 150%)
  o sol ficava parado e não dava mais pra mover. Eram três causas: as
  coordenadas do mouse vindas da janela ficam erradas entre escalas
  diferentes (agora o cursor é lido direto do sistema), o "soltei o botão"
  podia se perder (agora o arraste também termina se o botão não estiver
  mais pressionado), e o arredondamento do Windows engolia o passo de
  ~1px da caminhada (agora a posição é guardada pelo app).
- Corrigido: depois de levar o sol pra um monitor com outra escala, ele
  andava mas não dava mais pra clicar nem arrastar. A detecção de "mouse em
  cima do sol" dependia do repasse de mouse do Windows, que informa a
  posição errada nesses monitores; agora o app mesmo confere o cursor.
- Corrigido (de novo): mesmo com o cursor sendo lido certo, depois de
  levar o sol pro monitor de 150% não dava pra agarrar ele. A causa era um
  bug do Electron/Windows: a janela levada pra um monitor com outra escala
  perde o "apertei o botão" do mouse. Um redimensionamento de 1px ao trocar
  de monitor faz a janela voltar a receber o clique.
- Corrigido: clicar no sol encostado numa borda fazia ele "pular" pra
  dentro (pra abrir espaço pro balão). O balão agora tem janela própria e
  se posiciona sozinho — abaixo do sol se não houver espaço em cima, ou
  deslocado pro lado na borda. O sol fica sempre onde você deixou.
- Corrigido: depois de abrir o menu uma vez, abrir de novo podia falhar (o
  menu antigo, ao terminar de fechar, "desligava" o novo).
- Funciona com todos os monitores de quem estiver usando: dá pra arrastar
  o sol pra qualquer um. Andando sozinho ele fica no monitor onde está —
  só troca de tela quando arrastado.
- Monitor desconectado ou mudança de resolução/escala com o app aberto:
  o sol volta pro monitor mais próximo.

## Visual e feedback

- Redesenho do balão de dica (estava sendo cortado pela janela) e do
  brilho ao redor do sol quando fala (SVG com raios girando + glow
  pulsante, ajustado de tamanho algumas vezes até ficar colado ao sol).
- Animação de "fala" (squash-and-stretch) enquanto a dica está na tela, no
  lugar da animação de caminhada que continuava tocando por baixo.
- Som sintetizado (Web Audio API, sem arquivo de áudio) tocando junto com
  a dica.
- Animação de entrada do balão com efeito elástico (bounce).
- Bounce ao clicar no sol (achata, estica pra cima e assenta).

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

- O sol vira lua no modo respiração: durante a contagem regressiva ele
  rodopia e encolhe enquanto uma lua 🌛 com brilho azulado surge; é a lua
  que respira; no fim ela volta a ser sol.
- A transição virou um eclipse de verdade: a lua 🌚 emerge de trás do sol,
  dá uma volta completa de 360° orbitando na frente dele (sol sempre
  visível) e fecha a volta cobrindo o sol exatamente — eclipse total, com
  a lua escurecendo um pouco e a coroa solar (só o anel, sem os raios
  girando, bem mais colada na lua) visível ao redor. A volta pra sol é a
  mesma órbita ao contrário.
- Arremesso com física: soltar o sol em movimento continua o movimento
  dele, indo mais devagar aos poucos e quicando nas bordas da tela, até
  parar sozinho. Pegar ele de novo no meio do arremesso cancela.
- Enquanto está sendo arremessado, o sol fica com uma cara de tonto (😵) e
  o brilho ao redor pulsa bem sutil (encolhe um pouco e volta) girando
  bem devagar. Ao parar sozinho, volta ao normal na hora, sem transição.
- Corrigido: durante o arremesso o sol ficava sem nenhuma animação de
  corpo (só a respiração parada do idle, quase imperceptível em
  movimento). Agora ele balança/gira enquanto voa.
- Som ao clicar na lua (ou no balão) pra encerrar a respiração — um "puf"
  de transformação de volta pra sol.
- Pedir uma dica pelo menu durante o exercício de respiração não espera
  mais ele acabar sozinho: encerra na hora, com a mesma animação da lua
  virando sol de volta, e a dica aparece assim que a transição termina.
- Bounce ao clicar no sol (achata e volta ao normal).
- Batida na parede durante o arremesso: o sol "amassa" na hora do impacto
  (esguicha pro lado contrário e volta) e toca um "boing" curto cujo
  volume acompanha a força da batida.
- Opção "Mutar/Ativar sons" no menu, desliga o tin-tin-tin da dica e o
  boing da batida.
- Corrigido: o brilho ao redor do sol (raios + glow) ficava com uma
  "máscara" cortando a borda no pico do pulso — o `<svg>` corta o próprio
  desenho por padrão e o pulso passava um pouco do limite dele.

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

## Atualização automática

- Botão "Buscar atualização" no menu, e checagem silenciosa sozinha ao
  abrir (só na versão instalada). Quando acha uma atualização, baixa
  sozinha e avisa com um popup ("Atualizar agora" reinicia na hora,
  "Depois" instala na próxima vez que o app fechar normalmente).
- `npm run release` builda e publica o instalador direto como Release no
  GitHub — é o feed que a versão instalada consulta.
- Botão "Relatar um bug" no menu: abre uma issue nova no GitHub já
  preenchida com versão, sistema e idioma (não manda nada sozinho — só
  prepara, a pessoa ainda revisa e envia).
- Som ao abrir o menu (botão direito): um pop bem curto e seco.
- Ícone do app (instalador, atalhos, .exe): o próprio emoji 🌞, gerado
  num canvas a partir dele mesmo, em vez do ícone padrão do Electron.
- Opção no menu pra escolher se o solzinho inicia com o Windows ou não
  (antes era sempre ligado, sem jeito de desativar pelo próprio app).
- Corrigido: o arremesso parava de repente com o sol ainda visivelmente
  em movimento. Agora a reta final freia mais forte (~0,5s) até quase
  zero, um final suave em vez de um corte seco.
- Som da batida na parede trocado: em vez do boing/clique seco de antes,
  um toque de marimba quentinho (nota sorteada + harmônico suave, sem
  aspereza nenhuma).
- Todos os 4 sons do app (dica, batida, transformação, menu) unificados
  no mesmo "ar" cozy — mesma receita de filtro passa-baixa + onda
  triangular quentinha, em vez de cada um soar diferente.

## Boca, indicadores de menu e ajustes de arremesso/respiração

- O sol agora "mexe a boca" (um óvalo pequeno sobreposto ao rosto do
  emoji, abrindo e fechando rápido) enquanto está mostrando uma dica.
- As opções de estado persistente no menu (pausar dicas, caminhada, sons,
  iniciar com o Windows) ganharam um indicador visual de ligado/desligado,
  em vez de só trocar o texto do verbo.
- Sendo arrastado ou voando livre depois do arremesso, o sol agora tem uma
  cara de "weeeee" (antes só ficava com a cara de tonto durante o
  arremesso, e nada de especial durante o arraste). A cara de tonto virou
  uma reação rápida só no instante de bater numa borda, voltando sozinha
  pro "weeeee" logo em seguida.
- Simplificada a transformação sol/lua do exercício de respiração: em vez
  da lua orbitando o sol, agora é só a lua surgindo pequena e crescendo
  com um bounce no final (e o sol encolhendo/sumindo ao mesmo tempo) —
  e o mesmo movimento ao contrário na volta.
- Ao terminar o exercício (por clique ou pelo tempo acabar), o balão
  convida a repetir ("toque para respirar de novo", em destaque); tocando
  nele, a contagem regressiva começa de novo. Se ninguém tocar, volta ao
  normal sozinho depois de alguns segundos.
- Balão de pausa física (água/alongar) ganhou cor própria (verde-água),
  diferente do âmbar das dicas de acalmar — identidade visual pra
  diferenciar os dois tipos de lembrete de cara.
- Centralizado o texto das bandeirinhas de idioma (BR/US) no menu —
  estava levemente descentralizado dentro do retângulo do botão.
- Corrigido: com o menu aberto, se o sol se movesse (arraste ou quique de
  arremesso) até a área do menu, ficava escondido atrás dele — o menu,
  diferente do balão, rouba o topo da pilha de janelas ao abrir. Agora o
  sol volta pro topo sempre que se reposiciona com um popup aberto.
- Corrigido: na transformação sol/lua, os raios do sol (silhueta pontuda)
  apareciam espiando por trás da lua (redonda) no meio da animação,
  quando os dois encolhiam/cresciam ao mesmo tempo. Agora é sequencial —
  quem desaparece encolhe primeiro, só depois quem aparece cresce — sem
  nenhuma sobreposição entre os dois.
- Removido o brilho (corona) que ficava atrás do sol ao voltar da
  respiração (`moon-exit`) — não fazia mais sentido com a transformação
  simplificada; continua ligado normalmente durante o modo lua/respiração
  e ao dar uma dica.
- Boca de fala aumentada e com mais contraste — a versão anterior era
  pequena/clara demais e quase não dava pra perceber no tamanho real.
- Novo item de menu (só ícone, 🕶️): coloca/tira óculos escuros no sol,
  no formato Wayfarer clássico ("estilo Ray-Ban").
- Corrigido bug real: trocar a cara do sol (`sunEl.textContent = ...`)
  apagava os filhos do `#sun` — a boca e os óculos desapareciam de vez
  toda vez que o arremesso mudava a cara dele. O rosto agora vive num
  `<span>` próprio, sem mexer nos irmãos.
- Arremesso ganhou graus de empolgação conforme a velocidade atual (não
  só uma cara de "weeeee" fixa o tempo todo): rápido é a cara e o balanço
  cheios; mais devagar é um balanço bem mais discreto, cara normal; perto
  de já ter parado, a animação de idle/caminhada volta sozinha antes
  mesmo do arremesso terminar de vez.
- Respiração da lua com um pouco de squash-and-stretch (infla e sobe de
  leve no "inspira", esvazia abaixo do normal e desce no "solta") em vez
  de só um pulso uniforme de escala.
