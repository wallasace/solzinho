# Solzinho

Um mascote de desktop: um solzinho (🌞) que anda pela sua tela, sempre por
cima de todas as janelas, e de vez em quando aparece com uma dica curta pra
te ajudar a se acalmar — baseada em técnicas de psicologia (respiração,
grounding, autocompaixão, reestruturação cognitiva) — ou um lembrete de
pausa física (água, esticar, levantar). Também tem um exercício de
respiração guiado sob demanda.

Feito pra quem se preocupa demais e precisa de um empurrãozinho gentil de
vez em quando, sem abrir mão da tela pra isso.

![plataforma](https://img.shields.io/badge/plataforma-Windows-blue)
![licença](https://img.shields.io/badge/licença-PolyForm%20Internal%20Use%201.0.0-lightgrey)

## O que ele faz

- **Anda pela tela**: fica sempre por cima das outras janelas, para de vez
  em quando pra "respirar" (parado, animação de descanso), e pode ser
  arrastado pra qualquer lugar com o mouse.
- **Dicas de acalmar**: aparecem numa bolha de fala, num ritmo configurável
  (padrão: a cada ~30 min, com variação aleatória).
- **Lembretes de pausa física**: água, esticar, levantar — num ritmo próprio
  e independente das dicas de acalmar (padrão: a cada ~20 min).
- **Exercício de respiração guiado**: contagem regressiva de 3s, depois um
  ciclo de respiração quadrada (inspira 4s / segura 4s / solta 4s / segura
  4s × 4), com o próprio sol "respirando" em sincronia.
- **Clique no sol**: pede uma dica na hora (ou encerra o exercício de
  respiração, se estiver rolando um).
- **Botão direito**: menu com pausar dicas, ajustar frequência (com opção
  personalizada), parar/retomar a caminhada, pedir dica agora, iniciar o
  exercício de respiração e trocar o idioma (🇧🇷/🇺🇸).
- **Português e inglês**: toda a interface e as dicas têm as duas versões.
- **Abre com o Windows**: quando instalado (veja abaixo), já inicia sozinho
  no login.

## Como rodar

### Modo desenvolvimento

```bash
npm install
npm start
```

Ou dá duplo-clique em [`iniciar_solzinho.bat`](iniciar_solzinho.bat) pra
abrir sem precisar de terminal.

### Instalador (recomendado para uso do dia a dia)

```bash
npm run build
```

Gera um instalador em `dist/Solzinho Setup <versão>.exe`. Rodando esse
instalador, o Solzinho é instalado na sua conta de usuário (sem precisar de
admin), ganha atalho no menu iniciar/desktop, e passa a abrir sozinho
sempre que você liga o computador. Pra desligar isso, é só desmarcar a
opção equivalente nas configurações de inicialização do Windows
(`Configurações > Apps > Inicialização`) ou desinstalar pelo painel de
apps do Windows.

## Estrutura

Veja [ARCHITECTURE.md](ARCHITECTURE.md) para como o projeto é organizado
por dentro (processos do Electron, canais de IPC, sistema de idiomas).

Veja [CHANGELOG.md](CHANGELOG.md) para o histórico do que foi construído.

## Licença

Solzinho é software de código aberto para leitura ("source-available"), não
open source no sentido OSI. Uso pessoal, educacional e interno (seu ou da
empresa onde você trabalha) é livre e gratuito. Vender, redistribuir ou
embutir em um produto/serviço oferecido a terceiros precisa de uma licença
comercial separada.

Veja [LICENSE](LICENSE) para os termos completos e [COMMERCIAL.md](COMMERCIAL.md)
pra saber quando uma licença comercial é necessária e como pedir uma.

Créditos de terceiros em [NOTICE](NOTICE).
