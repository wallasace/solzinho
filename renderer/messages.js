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

    // Respiração
    'Inspira contando até 4, segura até 7, solta até 8. Repete mais uma vez, sem pressa.',
    'Põe uma mão no peito e outra na barriga. Respira de um jeito que só a de baixo se mexa.',
    'Antes de continuar, um suspiro bem grande e solto. Às vezes é só disso que o corpo precisa.',
    'Respira fundo e solta o ar fazendo barulho, tipo um "haaa". Libera mais tensão do que parece.',
    'Conta 10 respirações, sem mudar nada nelas. Só perceber já acalma.',
    'Imagina que está soprando uma vela bem devagar, sem apagar de vez. Essa é a exalação.',
    'Inspira pelo nariz em 4 tempos, solta pela boca em 6. O dobro na saída ativa o relaxamento.',
    'Uma respiração só, bem completa, enchendo até a parte de cima do peito. Depois solta tudo de uma vez.',
    'Fecha os olhos e respira três vezes sem contar nada, só sentindo o ar entrar e sair.',
    'Se o peito está apertado, solta o ar primeiro, até o fim, antes de inspirar de novo.',

    // Grounding sensorial
    'Olha pra cor mais viva que você consegue ver agora. Fica um instante só nela.',
    'Escuta: qual é o som mais distante que você consegue captar agora?',
    'Aperta as mãos uma na outra por 5 segundos, depois solta. Sente a diferença.',
    'Nomeia 3 objetos ao seu redor em voz baixa, bem devagar.',
    'Sente o peso do seu corpo na cadeira. Você está sendo sustentado agora mesmo.',
    'Repara na temperatura do ar na sua pele. Mais quente ou mais fresco que você esperava?',
    'Dá uma espreguiçada bem completa, braços pra cima, e solta com um suspiro.',
    'Olha pra um ponto fixo por 10 segundos sem desviar o olhar. Isso ajuda a aquietar a mente.',
    'Passa a mão numa superfície perto de você. Lisa, áspera, fria, quente?',
    'Alguma coisa no ambiente tem um cheiro agora? Repara nele por um instante.',

    // Autocompaixão
    'Você não precisa dar conta de tudo sozinho. Pedir ajuda também é competência.',
    'O jeito como você fala consigo mesmo importa. Tenta um tom mais gentil agora.',
    'Você já passou por coisas difíceis antes e chegou até aqui. Isso conta muito.',
    'Tratar a si mesmo com carinho não é indulgência, é manutenção necessária.',
    'Se você errou hoje, isso te torna humano, não incompetente.',
    'Você está fazendo o melhor que consegue com o que tem agora. Isso é o suficiente.',
    'Dá pra ser exigente com o resultado e gentil com você mesmo ao mesmo tempo.',
    'Ninguém rende igual o tempo todo. Hoje pode ser um dia de rendimento menor, tudo bem.',
    'Aquilo que você faria por um amigo cansado, você merece fazer por você também.',
    'Reconhecer que está difícil já é um ato de coragem, não de fraqueza.',

    // Reestruturação cognitiva
    'Esse pensamento é um fato ou uma previsão? Geralmente é só uma previsão.',
    'Se um amigo tivesse esse mesmo pensamento sobre a situação dele, o que você diria?',
    'Existe outra forma de olhar pra isso que seja igualmente verdadeira, mas menos pesada?',
    'Quantas vezes essa preocupação específica realmente virou o pior cenário? Geralmente poucas.',
    'Separar fatos de interpretações ajuda: o que de fato aconteceu, e o que você está assumindo?',
    'Essa é uma urgência real ou uma sensação de urgência? As duas coisas são diferentes.',
    'Daqui a um ano, isso ainda vai importar do jeito que importa agora?',
    'O que você diria pra si mesmo daqui a uma semana, olhando pra essa situação de fora?',
    'Essa preocupação está te ajudando a agir, ou só girando sem sair do lugar?',
    'Tem alguma parte disso que está sob seu controle agora? Foca só nela por um instante.',

    // Encorajamento sobre trabalho e produtividade
    'Fazer uma coisa de cada vez, bem feita, costuma valer mais que várias pela metade.',
    'Você não é o seu desempenho de hoje. Dias variam, e isso é normal.',
    'Terminar uma tarefa pequena agora pode te dar mais energia do que começar outra grande.',
    'Pausas não atrapalham o trabalho, fazem parte dele. O cérebro também precisa recarregar.',
    'Se travou numa tarefa, talvez o próximo passo não precise ser o passo final, só o próximo.',
    'Comparar seu começo com o meio de outra pessoa raramente é justo com você.',
    'O que já está pronto hoje, mesmo que pouco? Vale reconhecer antes de seguir.',
    'Produtividade não é se esgotar. É sustentar um ritmo que você aguenta repetir amanhã.',
    'Dar o seu melhor hoje não significa dar 100% o tempo inteiro. Significa se cuidar enquanto faz.',
    'Se a lista está grande demais, escolhe só a próxima coisa. O resto espera.',

    // Presença e mindfulness
    'Por um minuto, só sente o que está sentindo, sem tentar mudar nada.',
    'Reparar no agora não resolve o futuro, mas te tira de carregar os dois ao mesmo tempo.',
    'Dá uma olhada em volta: o que você normalmente não percebe nesse lugar?',
    'Sem julgar, só observa: como está seu corpo agora? Tenso, relaxado, cansado?',
    'Deixa o pensamento passar como uma nuvem, sem precisar segurar ele.',
    'Volta pra esse momento específico, só esse, sem o antes nem o depois.',
    'Repara em como você está respirando agora, sem tentar mudar o ritmo.',
    'Se a mente foi pro futuro, só nota isso com gentileza e traz ela de volta.',
    'Um minuto de silêncio, sem tela, sem fone. Só isso.',
    'Você está aqui agora. Essa frase simples às vezes já ajuda a aterrissar.',

    // Gratidão
    'Alguém fez algo gentil por você recentemente? Vale lembrar disso agora.',
    'Uma coisa simples que funciona na sua rotina e você quase nunca percebe: que tal notar agora?',
    'Pensa em algo que você tem hoje que não tinha há um ano.',
    'Qual sentido do seu corpo você mais aprecia agora: ver, ouvir, sentir?',
    'Um lugar confortável onde você já esteve hoje: consegue lembrar dele por um instante?',
    'Alguma conversa boa que você teve recentemente? Deixa ela voltar na memória.',
    'O que de bom essa pausa está te dando, mesmo que pequeno?',
    'Pensa em uma pessoa que você é grato por ter por perto.',
    'Seu corpo fez muita coisa por você hoje sem você perceber. Um obrigado silencioso vale.',
    'Existe algo chato que, visto de outro ângulo, também te ensinou algo?',

    // Perfeccionismo e autocrítica
    'Feito é melhor que perfeito, principalmente quando perfeito nunca chega.',
    '"Bom o suficiente" também é uma conquista válida, não só o resultado ideal.',
    'Você está se cobrando um padrão que cobraria de outra pessoa? Provavelmente não.',
    'Errar uma vez não apaga tudo que você já acertou até aqui.',
    'Perfeição é um alvo que se move — ele nunca fica satisfeito de verdade. Você pode escolher parar de persegui-lo agora.',
    'Dá pra entregar algo bom sem que seja o seu melhor absoluto de todos os tempos.',
    'A voz crítica na sua cabeça não é a verdade, é só uma opinião bem alta.',
    'Reparar no que deu certo também é importante, não só no que falta ajustar.',
    'Você pode refazer algo com calma depois. Agora, só avançar já é suficiente.',
    'Ser gentil com seus próprios erros tende a te ajudar mais do que ser duro com eles.',

    // Conexão social
    'Já faz um tempo que você não manda uma mensagem só pra saber como alguém está?',
    'Uma ligação rápida pode valer mais que horas de mensagem de texto. Vale considerar.',
    'Dividir o que está pesando com alguém de confiança costuma aliviar mais do que guardar sozinho.',
    'Perguntar "como você está de verdade?" pra alguém pode abrir uma conversa boa.',
    'Isolamento alimenta preocupação. Um contato breve com alguém pode quebrar esse ciclo.',
    'Quem você gostaria de agradecer hoje, mesmo que por algo pequeno?',
    'Compartilhar uma vitória pequena com alguém multiplica ela. Vale a pena contar.',
    'Pedir companhia, mesmo que só silenciosa, também é uma forma válida de cuidado.',
    'Uma risada com alguém de confiança hoje pode valer mais do que parece.',
    'Se tem alguém pensando em você, deixa isso te confortar por um instante.',

    // Sono e descanso
    'Cansaço acumulado afeta o humor mais do que a gente imagina. Como anda seu sono essa semana?',
    'Descansar não é o oposto de produzir, é o que sustenta a produção.',
    'Se puder, desliga as telas um pouco antes de dormir hoje. O corpo agradece.',
    'Um cochilo curto, de 10 a 20 minutos, pode recarregar sem te deixar grogue.',
    'Seu corpo também trabalha enquanto você descansa. Repousar também é fazer algo.',
    'Hoje à noite, tenta deitar 15 minutos mais cedo do que o normal.',
    'Rotina antes de dormir ajuda o corpo a entender que está na hora de desacelerar.',
    'Cafeína tarde pode estar atrapalhando seu sono sem você perceber a conexão.',
    'Descanso de verdade também inclui parar de pensar no trabalho, não só parar de fazê-lo.',
    'Você tem permissão pra parar mais cedo hoje, se o corpo estiver pedindo isso.',
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

    // Breathing
    'Inhale for a count of 4, hold for 7, release for 8. One more round, no rush.',
    'Put one hand on your chest and one on your belly. Breathe so only the lower one moves.',
    'Before you keep going, one big sigh and let it out loose. Sometimes that is all the body needs.',
    'Breathe in deep and let it out with a sound, like a "haaa". It releases more tension than it seems.',
    'Count 10 breaths without changing anything about them. Just noticing already calms things down.',
    'Picture gently blowing out a candle without putting it out all at once. That is the exhale.',
    'Breathe in through the nose for 4 counts, out through the mouth for 6. The longer exhale switches on the relax response.',
    'One full, complete breath, filling all the way to the top of the chest. Then let it all go at once.',
    'Close your eyes and take three breaths without counting, just feeling the air come and go.',
    "If your chest feels tight, empty it out first, all the way, before breathing in again.",

    // Sensory grounding
    'Look for the most vivid color you can see right now. Stay with it for a moment.',
    'Listen: what is the farthest sound you can pick up right now?',
    'Press your hands together for 5 seconds, then release. Notice the difference.',
    'Name 3 objects around you, quietly, slowly.',
    'Feel the weight of your body in the chair. You are being held up right now.',
    'Notice the temperature of the air on your skin. Warmer or cooler than you expected?',
    'Take a full stretch, arms up, and let it go with a sigh.',
    'Stare at a fixed point for 10 seconds without looking away. It helps quiet the mind.',
    'Run your hand over a surface near you. Smooth, rough, cold, warm?',
    'Is there a smell in the room right now? Notice it for a moment.',

    // Self-compassion
    "You don't have to handle everything on your own. Asking for help is a skill too.",
    'How you talk to yourself matters. Try a gentler tone right now.',
    "You've gotten through hard things before and made it here. That counts for a lot.",
    "Treating yourself with care isn't indulgence, it's necessary upkeep.",
    'If you made a mistake today, that makes you human, not incompetent.',
    "You're doing the best you can with what you have right now. That is enough.",
    'You can be demanding about the outcome and gentle with yourself at the same time.',
    "No one performs the same every day. Today can be a lower-output day, and that's fine.",
    'What you would do for a tired friend, you deserve to do for yourself too.',
    'Admitting this is hard is already an act of courage, not weakness.',

    // Cognitive reframing
    'Is this thought a fact or a prediction? Usually it is just a prediction.',
    'If a friend had this same thought about their situation, what would you tell them?',
    'Is there another way to look at this that is just as true, but lighter to carry?',
    'How many times has this exact worry actually turned into the worst case? Probably not many.',
    'Separating facts from interpretations helps: what actually happened, and what are you assuming?',
    'Is this a real emergency, or just a feeling of urgency? The two are different.',
    'A year from now, will this still matter the way it does right now?',
    'What would you tell yourself about this a week from now, looking at it from the outside?',
    'Is this worry helping you act, or just spinning without going anywhere?',
    'Is any part of this actually in your control right now? Focus on just that part for a moment.',

    // Encouragement about work and productivity
    'Doing one thing well usually beats doing several things halfway.',
    "You are not today's performance. Days vary, and that's normal.",
    'Finishing one small task now might give you more energy than starting a big one.',
    'Breaks are not a break from the work, they are part of it. The brain needs recharging too.',
    "If you're stuck, maybe the next step doesn't need to be the final one, just the next one.",
    "Comparing your beginning to someone else's middle is rarely fair to you.",
    "What's already done today, even if small? Worth acknowledging before moving on.",
    'Being productive is not about running yourself into the ground. It is about a pace you can repeat tomorrow.',
    'Giving your best today does not mean giving 100% every second. It means taking care of yourself while you do it.',
    "If the list feels too long, just pick the next thing. The rest can wait.",

    // Presence and mindfulness
    'For a minute, just feel what you are feeling, without trying to change it.',
    "Noticing the present doesn't fix the future, but it keeps you from carrying both at once.",
    'Take a look around: what do you usually not notice in this place?',
    'Without judging, just observe: how is your body right now? Tense, relaxed, tired?',
    'Let the thought pass like a cloud, without needing to hold onto it.',
    'Come back to this specific moment, just this one, without the before or after.',
    'Notice how you are breathing right now, without trying to change the pace.',
    'If your mind drifted to the future, just notice that gently and bring it back.',
    'One minute of quiet, no screen, no headphones. Just that.',
    'You are here right now. That simple sentence can help you land sometimes.',

    // Gratitude
    'Has someone done something kind for you recently? Worth remembering it now.',
    'Something simple that just works in your routine and you barely notice: how about noticing it now?',
    'Think of something you have today that you did not have a year ago.',
    'Which of your senses do you appreciate most right now: sight, hearing, touch?',
    'A comfortable place you were in today: can you picture it for a moment?',
    'Any good conversation you had recently? Let it come back to mind.',
    'What good is this break giving you, even if small?',
    'Think of one person you are grateful to have around.',
    'Your body did a lot for you today without you noticing. A silent thank you is worth it.',
    'Is there something annoying that, seen from another angle, also taught you something?',

    // Perfectionism and self-criticism
    'Done is better than perfect, especially when perfect never actually arrives.',
    '"Good enough" is also a valid achievement, not just the ideal outcome.',
    'Are you holding yourself to a standard you would not hold someone else to? Probably not.',
    'One mistake does not erase everything you have gotten right so far.',
    'Perfection is a moving target that is never truly satisfied. You can choose to stop chasing it right now.',
    'You can deliver something good without it being your absolute all-time best.',
    "The critical voice in your head isn't the truth, it's just a very loud opinion.",
    "Noticing what went well matters too, not just what still needs fixing.",
    'You can redo something calmly later. Right now, just moving forward is enough.',
    'Being gentle with your own mistakes tends to help more than being harsh with them.',

    // Social connection
    "Has it been a while since you sent someone a message just to check in?",
    'A quick call can be worth more than hours of texting. Worth considering.',
    'Sharing what is weighing on you with someone you trust usually helps more than carrying it alone.',
    'Asking someone "how are you really doing?" can open up a good conversation.',
    'Isolation feeds worry. A brief contact with someone can break that cycle.',
    'Who would you like to thank today, even for something small?',
    'Sharing a small win with someone multiplies it. Worth telling someone.',
    'Asking for company, even just quiet company, is also a valid form of care.',
    'A laugh with someone you trust today might be worth more than it seems.',
    'If someone is thinking of you, let that comfort you for a moment.',

    // Sleep and rest
    'Built-up tiredness affects mood more than we tend to think. How has your sleep been this week?',
    'Resting is not the opposite of producing, it is what sustains it.',
    'If you can, step away from screens a bit earlier than usual tonight. Your body will thank you.',
    'A short nap, 10 to 20 minutes, can recharge you without leaving you groggy.',
    'Your body is also working while you rest. Resting is doing something too.',
    'Tonight, try lying down 15 minutes earlier than usual.',
    'A wind-down routine helps your body understand it is time to slow down.',
    'Late caffeine might be affecting your sleep without you noticing the connection.',
    'Real rest also means stepping away from thinking about work, not just stepping away from doing it.',
    'You have permission to stop earlier today, if your body is asking for it.',
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
