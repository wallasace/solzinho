// O que mudou em cada versão, pt/en, pra mostrar na janela de "novidades"
// depois de uma atualização. Atualize isto a cada release com o que mudou
// desde a anterior — o main process só decide SE mostra (comparando
// versões); o texto em si mora aqui, perto do resto da i18n do renderer.
const RELEASE_NOTES = {
  '1.0.10': {
    pt: [
      'Só uma instância roda por vez agora: abrir o solzinho de novo mostra um aviso e faz o sol de verdade dar um pulinho, em vez de abrir duas cópias por cima uma da outra.',
      'Se o solzinho travar de verdade (crash), ele volta sozinho em vez de ficar em branco pro resto da sessão.',
      'Erros agora ficam registrados num arquivo local, pra dar pra investigar caso algo dê errado.',
      'As configurações são salvas de um jeito que não corrompe se o app fechar bem no meio da escrita.',
      'Novo ícone na bandeja do sistema, com o mesmo menu do clique direito no sol.',
      'Novo no menu: "🔒 Travar no monitor atual" — arrastar, arremessar e andar sozinho não trocam mais de tela.',
    ],
    en: [
      'Only one instance runs at a time now: opening Solzinho again shows a notice and makes the real one bounce, instead of opening two copies on top of each other.',
      'If Solzinho actually crashes, it comes back on its own instead of staying blank for the rest of the session.',
      'Errors are now logged to a local file, so there is something to investigate if anything goes wrong.',
      'Settings are now saved in a way that cannot get corrupted if the app closes mid-write.',
      'New system tray icon, with the same menu as right-clicking the sun.',
      'New in the menu: "🔒 Lock to current monitor" — dragging, flinging, and walking on its own no longer cross to another screen.',
    ],
  },
  '1.0.11': {
    pt: [
      'Corrigido: com a trava de monitor ligada, o arremesso (jogar o sol) ainda conseguia atravessar pra outra tela perto da borda — só o arraste estava respeitando a trava de verdade.',
      'Novo: esta janela! Depois de uma atualização, o solzinho mostra o que mudou desde a última vez, no seu idioma.',
    ],
    en: [
      'Fixed: with the monitor lock on, flinging the sun could still cross to another screen near the edge — only dragging was actually respecting the lock.',
      "New: this window! After an update, Solzinho shows what changed since last time, in your language.",
    ],
  },
};

// Compara "1.2.10" com "1.2.9" numericamente por partes — "1.2.10" > "1.2.9"
// embora "10" < "9" como texto puro.
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
