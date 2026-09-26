// Dicas curtas baseadas em técnicas de psicologia (respiração, grounding,
// autocompaixão, reestruturação cognitiva, pausa consciente), em pt e en.
const MESSAGES = {
  pt: [
    // Respiração
    'Respira comigo: inspira 4s, segura 4s, solta 4s, segura 4s. Mais uma vez?',
    'Solta os ombros. Inspira fundo pelo nariz... e solta bem devagar pela boca.',
    'Uma pausa de respiração agora vale mais do que parece. Três respirações fundas, só isso.',

    // Grounding 5-4-3-2-1
    'Olha ao redor: acha 5 coisas que você vê, 4 que você ouve, 3 que você sente. Isso te traz pro agora.',
    'Sente os pés no chão por um segundo. Você está aqui, agora, e está tudo bem no momento presente.',
    'Toca em algo perto de você. Textura, temperatura, peso. Isso ajuda a sair do automático.',

    // Autocompaixão
    'Você está se dedicando muito a isso. Isso já diz muito sobre você. Reconhece esse esforço.',
    'Se um amigo estivesse tão preocupado quanto você agora, o que você diria pra ele? Diz isso pra você também.',
    'Errar faz parte de fazer. Você não precisa ser perfeito pra estar indo bem.',
    'Cansaço não é fraqueza, é sinal. Você já fez muito até aqui hoje.',

    // Reestruturação cognitiva
    'Essa preocupação é sobre algo que já aconteceu, que está acontecendo, ou que pode nunca acontecer?',
    'Pergunta pra você: isso que te preocupa, você vai lembrar dele daqui a um mês?',
    'Qual é o pior cenário real, e o que você faria se ele acontecesse? Geralmente você tem mais recursos do que imagina.',
    'Preocupação resolve o que está no seu controle. O resto, você pode soltar por agora.',

    // Encorajamento sobre o trabalho
    'Dedicação é ótima, mas você também merece descanso. Os dois podem coexistir.',
    'Você não precisa terminar tudo hoje pra ter feito um bom trabalho hoje.',
    'Progresso pequeno ainda é progresso. Você está construindo algo, um passo de cada vez.',

    // Presença / distração gentil
    'Que tal 2 minutos olhando pela janela, sem tela nenhuma?',
    'Se a mente está acelerada, escreve rapidinho 3 coisas que estão te preocupando. Só nomear já ajuda.',
    'Uma coisa boa que aconteceu hoje, mesmo pequena: consegue lembrar de uma?',
  ],
  en: [
    // Breathing
    'Breathe with me: inhale 4s, hold 4s, exhale 4s, hold 4s. One more time?',
    'Drop your shoulders. Breathe in deeply through your nose... and out slowly through your mouth.',
    'A breathing pause right now is worth more than it seems. Just three deep breaths.',

    // Grounding 5-4-3-2-1
    'Look around: find 5 things you see, 4 you hear, 3 you can feel. It brings you back to now.',
    'Feel your feet on the ground for a second. You are here, now, and that is okay in this moment.',
    'Touch something near you. Texture, temperature, weight. It helps you step out of autopilot.',

    // Self-compassion
    "You're putting a lot into this. That already says a lot about you. Acknowledge that effort.",
    "If a friend were as worried as you are right now, what would you tell them? Say that to yourself too.",
    "Making mistakes is part of doing. You don't have to be perfect to be doing well.",
    "Tiredness isn't weakness, it's a signal. You've already done a lot today.",

    // Cognitive reframing
    'Is this worry about something that already happened, is happening, or might never happen?',
    'Ask yourself: will you still remember this worry a month from now?',
    'What is the real worst case, and what would you do if it happened? You usually have more resources than you think.',
    'Worry solves what is within your control. The rest, you can let go of for now.',

    // Encouragement about the work
    "Dedication is great, but you deserve rest too. Both can coexist.",
    "You don't need to finish everything today to have done good work today.",
    "Small progress is still progress. You're building something, one step at a time.",

    // Presence / gentle distraction
    'How about 2 minutes looking out the window, no screens at all?',
    "If your mind is racing, jot down 3 things that are worrying you. Just naming them helps.",
    'Something good that happened today, even small: can you think of one?',
  ],
};

// Lembretes de pausa física: água, esticada, levantar — num ritmo próprio,
// independente das dicas de acalmar.
const PHYSICAL_MESSAGES = {
  pt: [
    'Bebe um golinho de água agora. Seu corpo agradece.',
    'Levanta e dá uma esticada rápida: braços pra cima, respira fundo.',
    'Já faz um tempo que você não sai da cadeira. Que tal 1 minuto de pé?',
    'Gira os ombros pra trás umas 5 vezes, solta a tensão.',
    'Estica as pernas: levanta, dá uns passos, e volta.',
    'Hidrata! Um copo de água agora cai bem.',
    'Alonga o pescoço de um lado pro outro, bem devagar.',
    'Levanta e olha pra longe por alguns segundos — descansa a vista também.',
    'Aperta e solta as mãos algumas vezes, tira a tensão dos dedos.',
    'Vale a pena levantar e ir beber um pouco de água.',
  ],
  en: [
    'Drink a sip of water right now. Your body will thank you.',
    'Stand up and do a quick stretch: arms up, take a deep breath.',
    "It's been a while since you left the chair. How about 1 minute on your feet?",
    'Roll your shoulders back about 5 times, release the tension.',
    'Stretch your legs: stand up, take a few steps, and come back.',
    'Hydrate! A glass of water sounds good right now.',
    'Stretch your neck from side to side, nice and slow.',
    'Stand up and look far away for a few seconds — rest your eyes too.',
    'Clench and release your hands a few times to ease the tension in your fingers.',
    "It's worth getting up to drink some water.",
  ],
};

function pickMessage(pool, lastText) {
  if (pool.length === 1) return pool[0];
  let candidate;
  do {
    candidate = pool[Math.floor(Math.random() * pool.length)];
  } while (candidate === lastText);
  return candidate;
}
