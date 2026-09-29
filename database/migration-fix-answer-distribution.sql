-- ============================================================================
--  Migração: corrigir distribuição da resposta certa entre A/B/C/D
-- ----------------------------------------------------------------------------
--  Bug encontrado: a esmagadora maioria das 120 perguntas tinha a resposta
--  correta sempre na alternativa A (112/120), tornando o quiz previsível.
--  Este script reembaralha a posição das alternativas em cada pergunta,
--  preservando os textos e o gabarito lógico (apenas a LETRA correta muda),
--  balanceando aproximadamente 2-3 respostas certas por letra em cada
--  banco de 10 perguntas por profeta.
--  Não afeta usuários, ranking, histórico, partidas ou conquistas.
--  Idempotente: pode ser executado mais de uma vez (cada UPDATE apenas
--  redefine os campos para o valor final correto).
-- ============================================================================

update public.questions set
  option_a = 'Miquéias',
  option_b = 'Amós',
  option_c = 'Oséias',
  option_d = 'Joel',
  correct_answer = 'C'::answer_letter
where book = 'oseias' and question = 'Qual é o nome do profeta que recebeu de Deus a ordem de se casar com uma mulher de prostituição?';

update public.questions set
  option_a = 'Como um rei estrangeiro',
  option_b = 'Como um guerreiro derrotado',
  option_c = 'Como um comerciante',
  option_d = 'Como um pai que ensinou seu filho a andar',
  correct_answer = 'D'::answer_letter
where book = 'oseias' and question = 'Em Oséias 11, como Deus descreve seu relacionamento com Israel?';

update public.questions set
  option_a = 'Construções',
  option_b = 'Conhecimento de Deus',
  option_c = 'Vitórias militares',
  option_d = 'Riquezas',
  correct_answer = 'B'::answer_letter
where book = 'oseias' and question = 'O que Oséias 6:6 diz que Deus deseja mais do que sacrifícios?';

update public.questions set
  option_a = 'Escolher um novo rei',
  option_b = 'Construir um novo templo',
  option_c = 'Voltar ao Senhor',
  option_d = 'Fugir para o Egito',
  correct_answer = 'C'::answer_letter
where book = 'oseias' and question = 'Qual é o convite final do livro de Oséias?';

update public.questions set
  option_a = 'A construção do templo',
  option_b = 'A idolatria e a ruptura da aliança com Deus',
  option_c = 'A invasão da Assíria apenas',
  option_d = 'A divisão das tribos no deserto',
  correct_answer = 'B'::answer_letter
where book = 'oseias' and question = 'No simbolismo de Oséias 2, o que representa a infidelidade de Israel?';

update public.questions set
  option_a = 'Não há conhecimento de Deus na terra',
  option_b = 'O rei foi deposto',
  option_c = 'O templo foi destruído',
  option_d = 'O povo é rico demais',
  correct_answer = 'A'::answer_letter
where book = 'oseias' and question = 'Qual acusação abre a controvérsia de Deus com Israel em Oséias 4?';

update public.questions set
  option_a = 'Quem construirá o templo?',
  option_b = 'Quando virá o novo rei?',
  option_c = 'Onde está a arca da aliança?',
  option_d = 'Onde está, ó morte, o teu aguilhão?',
  correct_answer = 'D'::answer_letter
where book = 'oseias' and question = 'Qual pergunta desafiadora sobre a morte aparece em Oséias 13:14?';

update public.questions set
  option_a = 'Medo',
  option_b = 'Discórdia',
  option_c = 'Ouro',
  option_d = 'Justiça',
  correct_answer = 'D'::answer_letter
where book = 'oseias' and question = 'O que Oséias 10:12 convida o povo a semear?';

update public.questions set
  option_a = 'Voltará ao seu lugar',
  option_b = 'Abandonará os profetas',
  option_c = 'Enviará outro dilúvio',
  option_d = 'Destruirá o mundo',
  correct_answer = 'A'::answer_letter
where book = 'oseias' and question = 'Em Oséias 5:15, o que Deus diz que fará até que o povo reconheça sua culpa?';

update public.questions set
  option_a = 'Um terremoto',
  option_b = 'Uma invasão de gafanhotos',
  option_c = 'Uma enchente',
  option_d = 'Uma seca no Egito',
  correct_answer = 'B'::answer_letter
where book = 'joel' and question = 'Qual desastre ocupa grande parte do capítulo 1 de Joel?';

update public.questions set
  option_a = 'O seu ouro',
  option_b = 'O seu templo',
  option_c = 'A sua espada',
  option_d = 'O seu Espírito',
  correct_answer = 'D'::answer_letter
where book = 'joel' and question = 'O que Deus promete derramar sobre toda carne em Joel 2?';

update public.questions set
  option_a = 'Construir uma fortaleza',
  option_b = 'Migrar para outra terra',
  option_c = 'Parar de orar',
  option_d = 'Voltar ao Senhor de todo o coração',
  correct_answer = 'D'::answer_letter
where book = 'joel' and question = 'Qual atitude Joel 2:12-13 pede ao povo?';

update public.questions set
  option_a = 'Monte Carmelo',
  option_b = 'Vale de Elá',
  option_c = 'Vale de Josafá',
  option_d = 'Deserto do Sinai',
  correct_answer = 'C'::answer_letter
where book = 'joel' and question = 'Segundo Joel 3, onde as nações são reunidas para julgamento?';

update public.questions set
  option_a = 'A chuva cessará por quarenta anos',
  option_b = 'As montanhas desaparecerão',
  option_c = 'O mar se tornará doce',
  option_d = 'O sol se converterá em trevas e a lua em sangue',
  correct_answer = 'D'::answer_letter
where book = 'joel' and question = 'Qual fenômeno é citado junto à promessa do Espírito e aos sinais no céu?';

update public.questions set
  option_a = 'Os exércitos vizinhos',
  option_b = 'Os sacerdotes apenas',
  option_c = 'Os bêbados',
  option_d = 'Os reis estrangeiros',
  correct_answer = 'C'::answer_letter
where book = 'joel' and question = 'Quem Joel convoca a despertar e chorar por causa da devastação em Joel 1:5?';

update public.questions set
  option_a = 'A trombeta',
  option_b = 'Os címbalos',
  option_c = 'O tambor',
  option_d = 'A harpa',
  correct_answer = 'A'::answer_letter
where book = 'joel' and question = 'O que o povo deve tocar em Sião para anunciar o perigo em Joel 2:1?';

update public.questions set
  option_a = 'Os anos que o gafanhoto comeu',
  option_b = 'Os tronos derrubados',
  option_c = 'As tribos perdidas',
  option_d = 'As muralhas da cidade',
  correct_answer = 'A'::answer_letter
where book = 'joel' and question = 'O que Deus promete restituir em Joel 2:25?';

update public.questions set
  option_a = 'Suas tendas',
  option_b = 'As relhas dos seus arados',
  option_c = 'Seus rebanhos',
  option_d = 'Seus templos',
  correct_answer = 'B'::answer_letter
where book = 'joel' and question = 'Em Joel 3:10, o que as nações são chamadas a transformar em espadas?';

update public.questions set
  option_a = 'Será salvo',
  option_b = 'Perderá seus bens',
  option_c = 'Será exilado',
  option_d = 'Será esquecido',
  correct_answer = 'A'::answer_letter
where book = 'joel' and question = 'Segundo Joel 2:32, o que acontecerá a todo aquele que invocar o nome do Senhor?';

update public.questions set
  option_a = 'Rei',
  option_b = 'Pastor de ovelhas e cultivador de sicômoros',
  option_c = 'Pescador',
  option_d = 'Sacerdote',
  correct_answer = 'B'::answer_letter
where book = 'amos' and question = 'Qual era a profissão de Amós antes de exercer seu ministério profético?';

update public.questions set
  option_a = 'O ouro',
  option_b = 'O vinho',
  option_c = 'A guerra',
  option_d = 'A justiça',
  correct_answer = 'D'::answer_letter
where book = 'amos' and question = 'O que Amós 5:24 diz que deve correr como um rio?';

update public.questions set
  option_a = 'Uma escada',
  option_b = 'Uma arca',
  option_c = 'Um cesto de frutas de verão',
  option_d = 'Um carro de fogo',
  correct_answer = 'C'::answer_letter
where book = 'amos' and question = 'O que Amós vê em uma das primeiras visões do capítulo 7?';

update public.questions set
  option_a = 'Chuva e bênção',
  option_b = 'Fruta de verão e fim chegou',
  option_c = 'Templo e altar',
  option_d = 'Rei e sacerdote',
  correct_answer = 'B'::answer_letter
where book = 'amos' and question = 'Na visão do cesto de frutas de verão, qual jogo de palavras aparece?';

update public.questions set
  option_a = 'Leoas do deserto',
  option_b = 'Vacas de Basã',
  option_c = 'Pombas do vale',
  option_d = 'Águias da montanha',
  correct_answer = 'B'::answer_letter
where book = 'amos' and question = 'Como Amós 4:1 chama as mulheres opressoras de Samaria?';

update public.questions set
  option_a = 'O tabernáculo caído de Davi',
  option_b = 'O templo de Baal',
  option_c = 'O palácio do Egito',
  option_d = 'A muralha de Nínive',
  correct_answer = 'A'::answer_letter
where book = 'amos' and question = 'O que Deus promete restaurar em Amós 9:11?';

update public.questions set
  option_a = 'Vender terras para o Egito',
  option_b = 'Vender animais sagrados',
  option_c = 'Vender o justo por prata e o pobre por um par de sandálias',
  option_d = 'Vender armas para a Assíria',
  correct_answer = 'C'::answer_letter
where book = 'amos' and question = 'Do que Israel é acusado em Amós 2:6, ao vender pessoas?';

update public.questions set
  option_a = 'Os estrangeiros pobres',
  option_b = 'Os pastores humildes',
  option_c = 'Os que vivem sossegados em Sião',
  option_d = 'Os sacerdotes fiéis',
  correct_answer = 'C'::answer_letter
where book = 'amos' and question = 'Contra quem é o "ai" pronunciado em Amós 6:1?';

update public.questions set
  option_a = 'O rei da Assíria',
  option_b = 'Um profeta rival',
  option_c = 'Jeroboão pessoalmente',
  option_d = 'Amazias, sacerdote de Betel',
  correct_answer = 'D'::answer_letter
where book = 'amos' and question = 'Quem ordenou que Amós fugisse para Judá e parasse de profetizar em Betel?';

update public.questions set
  option_a = 'Egito',
  option_b = 'Moabe',
  option_c = 'Assíria',
  option_d = 'Edom',
  correct_answer = 'D'::answer_letter
where book = 'obadias' and question = 'Qual nação é o principal alvo da profecia de Obadias?';

update public.questions set
  option_a = 'Isaque',
  option_b = 'Esaú',
  option_c = 'Jacó',
  option_d = 'José',
  correct_answer = 'B'::answer_letter
where book = 'obadias' and question = 'Edom é associado a qual ancestral?';

update public.questions set
  option_a = 'Por cultivar oliveiras',
  option_b = 'Por construir o templo',
  option_c = 'Por abandonar o Egito',
  option_d = 'Por sua violência contra seu irmão Jacó',
  correct_answer = 'D'::answer_letter
where book = 'obadias' and question = 'Por que Edom é condenado em Obadias?';

update public.questions set
  option_a = 'Um exército estrangeiro',
  option_b = 'Uma nova pirâmide',
  option_c = 'Livramento e santidade',
  option_d = 'Uma grande frota',
  correct_answer = 'C'::answer_letter
where book = 'obadias' and question = 'O que Obadias 17 promete que haverá no monte Sião?';

update public.questions set
  option_a = 'O reino será do Senhor',
  option_b = 'Não haverá restauração',
  option_c = 'Edom governará para sempre',
  option_d = 'Babilônia dominará Judá',
  correct_answer = 'A'::answer_letter
where book = 'obadias' and question = 'Qual é a ideia central do final de Obadias sobre o reino?';

update public.questions set
  option_a = 'A fome',
  option_b = 'A ignorância',
  option_c = 'A pobreza',
  option_d = 'A soberba',
  correct_answer = 'D'::answer_letter
where book = 'obadias' and question = 'Segundo Obadias 3, o que enganou o coração de Edom?';

update public.questions set
  option_a = 'Nas fendas das rochas, em lugar alto',
  option_b = 'Em barcos no mar Vermelho',
  option_c = 'Nas margens do rio Nilo',
  option_d = 'Em tendas no deserto do Sinai',
  correct_answer = 'A'::answer_letter
where book = 'obadias' and question = 'Onde Edom habitava, segundo a descrição de Obadias 3?';

update public.questions set
  option_a = 'Defendeu Jerusalém com seu exército',
  option_b = 'Ficou de lado e se comportou como um deles',
  option_c = 'Avisou os profetas com antecedência',
  option_d = 'Abrigou os refugiados de Judá',
  correct_answer = 'B'::answer_letter
where book = 'obadias' and question = 'Qual foi a atitude de Edom quando estrangeiros saquearam Jerusalém, segundo Obadias 11?';

update public.questions set
  option_a = 'Quem semeia pouco colhe muito',
  option_b = 'Como fizeste, se fará a ti',
  option_c = 'Não haverá julgamento para nenhuma nação',
  option_d = 'O rico sempre vencerá',
  correct_answer = 'B'::answer_letter
where book = 'obadias' and question = 'Qual princípio de reciprocidade aparece em Obadias 15?';

update public.questions set
  option_a = 'Um rio caudaloso',
  option_b = 'Ouro puro',
  option_c = 'Restolho, que será consumido',
  option_d = 'Uma torre inabalável',
  correct_answer = 'C'::answer_letter
where book = 'obadias' and question = 'Em Obadias 18, a que a casa de Esaú é comparada diante do fogo de Jacó e José?';

update public.questions set
  option_a = 'Nínive',
  option_b = 'Babilônia',
  option_c = 'Jerusalém',
  option_d = 'Samaria',
  correct_answer = 'A'::answer_letter
where book = 'jonas' and question = 'Para qual cidade Jonas foi enviado para pregar?';

update public.questions set
  option_a = 'Um navio',
  option_b = 'Um crocodilo',
  option_c = 'Um grande peixe',
  option_d = 'Uma baleia mencionada pelo nome',
  correct_answer = 'C'::answer_letter
where book = 'jonas' and question = 'O que engoliu Jonas depois que ele foi lançado ao mar?';

update public.questions set
  option_a = 'Prenderam Jonas',
  option_b = 'Ignoraram a mensagem',
  option_c = 'Arrependeram-se e proclamaram jejum',
  option_d = 'Foram para Jerusalém',
  correct_answer = 'C'::answer_letter
where book = 'jonas' and question = 'Como os ninivitas reagiram à pregação de Jonas?';

update public.questions set
  option_a = 'Porque perdeu o barco',
  option_b = 'Porque não recebeu pagamento',
  option_c = 'Porque o peixe voltou',
  option_d = 'Porque Deus não destruiu a cidade',
  correct_answer = 'D'::answer_letter
where book = 'jonas' and question = 'Por que Jonas ficou descontente depois da misericórdia de Deus para Nínive?';

update public.questions set
  option_a = 'Uma figueira',
  option_b = 'Um mamoeiro',
  option_c = 'Uma videira',
  option_d = 'Uma planta chamada mamona na tradição portuguesa',
  correct_answer = 'D'::answer_letter
where book = 'jonas' and question = 'Que planta Deus fez crescer para dar sombra a Jonas?';

update public.questions set
  option_a = 'Társis',
  option_b = 'Damasco',
  option_c = 'Jerusalém',
  option_d = 'Babilônia',
  correct_answer = 'A'::answer_letter
where book = 'jonas' and question = 'Para onde Jonas tentou fugir em vez de ir a Nínive?';

update public.questions set
  option_a = 'Lançaram sortes',
  option_b = 'Consultaram um oráculo egípcio',
  option_c = 'Jonas confessou espontaneamente logo no início',
  option_d = 'Um anjo apareceu',
  correct_answer = 'A'::answer_letter
where book = 'jonas' and question = 'Como os marinheiros descobriram que Jonas era o responsável pela tempestade?';

update public.questions set
  option_a = 'A salvação vem dos sacerdotes',
  option_b = 'Não há salvação possível',
  option_c = 'A salvação pertence ao Senhor',
  option_d = 'A salvação depende dos marinheiros',
  correct_answer = 'C'::answer_letter
where book = 'jonas' and question = 'O que Jonas declara sobre a salvação em sua oração de dentro do peixe (Jonas 2:9)?';

update public.questions set
  option_a = 'Os reis da terra se converterão',
  option_b = 'Ainda quarenta dias, e Nínive será destruída',
  option_c = 'Nínive será poupada para sempre',
  option_d = 'Israel será restaurado em breve',
  correct_answer = 'B'::answer_letter
where book = 'jonas' and question = 'Qual foi a mensagem exata que Jonas pregou em Nínive, segundo Jonas 3:4?';

update public.questions set
  option_a = 'Um milhão',
  option_b = 'Mais de cento e vinte mil',
  option_c = 'Doze mil',
  option_d = 'Exatamente cem',
  correct_answer = 'B'::answer_letter
where book = 'jonas' and question = 'No argumento final de Deus a Jonas, quantas pessoas incapazes de discernir a mão direita da esquerda havia em Nínive?';

update public.questions set
  option_a = 'Jericó',
  option_b = 'Tiro',
  option_c = 'Moresete',
  option_d = 'Belém',
  correct_answer = 'C'::answer_letter
where book = 'miqueias' and question = 'De onde era Miquéias?';

update public.questions set
  option_a = 'Nínive',
  option_b = 'Hebrom',
  option_c = 'Jerusalém',
  option_d = 'Belém Efrata',
  correct_answer = 'D'::answer_letter
where book = 'miqueias' and question = 'Qual cidade é mencionada como origem do governante prometido?';

update public.questions set
  option_a = 'Oferecer milhares de cavalos',
  option_b = 'Construir grandes palácios',
  option_c = 'Conquistar outras nações',
  option_d = 'Praticar a justiça, amar a misericórdia e andar humildemente com Deus',
  correct_answer = 'D'::answer_letter
where book = 'miqueias' and question = 'Segundo Miquéias 6:8, o que o Senhor requer do ser humano?';

update public.questions set
  option_a = 'Templos em palácios',
  option_b = 'Espadas em arados e lanças em foices',
  option_c = 'Arados em espadas',
  option_d = 'Rios em estradas',
  correct_answer = 'B'::answer_letter
where book = 'miqueias' and question = 'O que Miquéias 4:3 diz que as nações transformarão?';

update public.questions set
  option_a = 'Eles reconstruíram Nínive',
  option_b = 'Eles aborreciam o bem e amavam o mal',
  option_c = 'Eles abandonaram a agricultura',
  option_d = 'Eles serviam como sacerdotes fiéis',
  correct_answer = 'B'::answer_letter
where book = 'miqueias' and question = 'Qual crítica Miquéias faz aos líderes que deveriam conhecer a justiça?';

update public.questions set
  option_a = 'Os que maquinam a iniquidade em suas camas',
  option_b = 'As crianças de Judá',
  option_c = 'Os pastores fiéis',
  option_d = 'Os estrangeiros pobres',
  correct_answer = 'A'::answer_letter
where book = 'miqueias' and question = 'Contra quem é pronunciado o "ai" em Miquéias 2:1?';

update public.questions set
  option_a = 'Fugirei para sempre',
  option_b = 'Desistirei',
  option_c = 'Levantar-me-ei',
  option_d = 'Esconder-me-ei',
  correct_answer = 'C'::answer_letter
where book = 'miqueias' and question = 'O que Miquéias declara em 7:8 mesmo depois de cair?';

update public.questions set
  option_a = 'Reparte-os entre as nações',
  option_b = 'Transforma-os em ouro',
  option_c = 'Lança-os nas profundezas do mar',
  option_d = 'Guarda-os para sempre',
  correct_answer = 'C'::answer_letter
where book = 'miqueias' and question = 'Segundo Miquéias 7:19, o que Deus faz com os pecados do seu povo?';

update public.questions set
  option_a = 'De sabedoria humana apenas',
  option_b = 'Do poder do Espírito do Senhor',
  option_c = 'De exércitos',
  option_d = 'De riquezas materiais',
  correct_answer = 'B'::answer_letter
where book = 'miqueias' and question = 'Em contraste com falsos profetas, do que Miquéias 3:8 diz estar cheio?';

update public.questions set
  option_a = 'Jotão, Acaz e Ezequias',
  option_b = 'Herodes e Augusto',
  option_c = 'Saul, Davi e Salomão',
  option_d = 'Nabucodonosor e Ciro',
  correct_answer = 'A'::answer_letter
where book = 'miqueias' and question = 'Durante o reinado de quais reis de Judá Miquéias profetizou, segundo Miquéias 1:1?';

update public.questions set
  option_a = 'Damasco',
  option_b = 'Tiro',
  option_c = 'Nínive',
  option_d = 'Jerusalém',
  correct_answer = 'C'::answer_letter
where book = 'naum' and question = 'Contra qual cidade é dirigida a profecia de Naum?';

update public.questions set
  option_a = 'Fraco e indeciso',
  option_b = 'Sempre irado sem misericórdia',
  option_c = 'Tardio em irar-se e grande em poder',
  option_d = 'Indiferente ao mal',
  correct_answer = 'C'::answer_letter
where book = 'naum' and question = 'Como Naum descreve o Senhor em relação à ira?';

update public.questions set
  option_a = 'Carros correndo pelas ruas e portas dos rios abertas',
  option_b = 'Uma seca no deserto',
  option_c = 'Um templo sendo reconstruído',
  option_d = 'Um exército chegando de Jerusalém',
  correct_answer = 'A'::answer_letter
where book = 'naum' and question = 'Qual imagem aparece na descrição da queda de Nínive?';

update public.questions set
  option_a = 'Por ser pequena',
  option_b = 'Por sua violência, mentira e exploração',
  option_c = 'Por seus muitos jardins',
  option_d = 'Por sua riqueza agrícola',
  correct_answer = 'B'::answer_letter
where book = 'naum' and question = 'Por que Nínive é chamada de cidade sanguinária?';

update public.questions set
  option_a = 'Ser reconstruída como capital de Judá',
  option_b = 'Ser destruída e não ter cura para sua ferida',
  option_c = 'Receber um novo templo',
  option_d = 'Governar o Egito',
  correct_answer = 'B'::answer_letter
where book = 'naum' and question = 'Qual é o destino anunciado para Nínive?';

update public.questions set
  option_a = 'Bom e fortaleza no dia da angústia',
  option_b = 'Ausente em tempos de crise',
  option_c = 'Distante e indiferente',
  option_d = 'Fraco diante dos inimigos',
  correct_answer = 'A'::answer_letter
where book = 'naum' and question = 'Como Naum 1:7 descreve o Senhor para os que confiam nele?';

update public.questions set
  option_a = 'Uma nuvem de gafanhotos',
  option_b = 'Um novo exército assírio',
  option_c = 'Os pés do que anuncia a paz',
  option_d = 'Uma seca prolongada',
  correct_answer = 'C'::answer_letter
where book = 'naum' and question = 'O que Naum 1:15 anuncia que chega sobre os montes?';

update public.questions set
  option_a = 'Uma noiva fiel',
  option_b = 'Uma cidade santa',
  option_c = 'Uma mãe protetora',
  option_d = 'Uma prostituta encantadora e mestra de feitiços',
  correct_answer = 'D'::answer_letter
where book = 'naum' and question = 'A que Nínive é comparada em Naum 3:4 por causa de suas seduções?';

update public.questions set
  option_a = 'Um templo sagrado',
  option_b = 'Um covil de leões',
  option_c = 'Uma torre pacífica',
  option_d = 'Um jardim florido',
  correct_answer = 'B'::answer_letter
where book = 'naum' and question = 'A que Nínive é comparada em Naum 2:11-12, por causa de sua violência conquistadora?';

update public.questions set
  option_a = 'Que reconstruiria o templo de Jerusalém',
  option_b = 'Que se tornaria aliado de Judá',
  option_c = 'Que seria coroado rei universal',
  option_d = 'Que seu nome não teria mais descendência',
  correct_answer = 'D'::answer_letter
where book = 'naum' and question = 'O que Deus decreta contra a descendência do rei assírio em Naum 1:14?';

update public.questions set
  option_a = 'Interpreta sonhos de Nabucodonosor',
  option_b = 'Foge para o Egito',
  option_c = 'Questiona a Deus sobre a violência e a injustiça',
  option_d = 'Constrói um altar',
  correct_answer = 'C'::answer_letter
where book = 'habacuque' and question = 'O que Habacuque faz principalmente no início do livro?';

update public.questions set
  option_a = 'O Senhor é meu pastor',
  option_b = 'Tudo é vaidade',
  option_c = 'O justo viverá pela sua fé',
  option_d = 'Olho por olho',
  correct_answer = 'C'::answer_letter
where book = 'habacuque' and question = 'Qual frase famosa aparece em Habacuque 2:4?';

update public.questions set
  option_a = 'Escrevê-la claramente em tábuas',
  option_b = 'Entregá-la ao rei do Egito',
  option_c = 'Apagá-la',
  option_d = 'Escondê-la',
  correct_answer = 'A'::answer_letter
where book = 'habacuque' and question = 'O que Deus manda Habacuque fazer com a visão?';

update public.questions set
  option_a = 'Com silêncio absoluto',
  option_b = 'Com alegria e confiança em Deus',
  option_c = 'Com uma coroação',
  option_d = 'Com uma fuga',
  correct_answer = 'B'::answer_letter
where book = 'habacuque' and question = 'Apesar da crise, como termina a oração de Habacuque?';

update public.questions set
  option_a = 'Os filisteus',
  option_b = 'Os caldeus',
  option_c = 'Os egípcios',
  option_d = 'Os edomitas',
  correct_answer = 'B'::answer_letter
where book = 'habacuque' and question = 'Qual povo Deus diz que levantará como instrumento de juízo?';

update public.questions set
  option_a = 'Eis que o rei chegou vitorioso',
  option_b = 'O templo está reconstruído',
  option_c = 'Louvado seja o Senhor para sempre',
  option_d = 'Até quando, Senhor, clamarei e tu não ouvirás?',
  correct_answer = 'D'::answer_letter
where book = 'habacuque' and question = 'Como começa o lamento de Habacuque no capítulo 1?';

update public.questions set
  option_a = 'Uma frota poderosa',
  option_b = 'Um exército invencível',
  option_c = 'Um novo templo de ouro',
  option_d = 'Pés como os das cervas, andando nas alturas',
  correct_answer = 'D'::answer_letter
where book = 'habacuque' and question = 'Com que imagem de força Habacuque 3:19 termina o livro?';

update public.questions set
  option_a = 'As águas do dilúvio',
  option_b = 'O ouro das nações',
  option_c = 'O conhecimento da glória do Senhor',
  option_d = 'Os exércitos da Babilônia',
  correct_answer = 'C'::answer_letter
where book = 'habacuque' and question = 'O que Habacuque 2:14 promete que encherá a terra?';

update public.questions set
  option_a = 'Nenhum',
  option_b = 'Dez',
  option_c = 'Dois',
  option_d = 'Cinco',
  correct_answer = 'D'::answer_letter
where book = 'habacuque' and question = 'Quantos "ais" (pronunciamentos de juízo) Habacuque declara contra o opressor no capítulo 2?';

update public.questions set
  option_a = 'Amós',
  option_b = 'Ezequias',
  option_c = 'Cusi',
  option_d = 'Hulda',
  correct_answer = 'C'::answer_letter
where book = 'sofonias' and question = 'Quem é identificado como pai de Sofonias?';

update public.questions set
  option_a = 'A festa das colheitas',
  option_b = 'O ano do jubileu',
  option_c = 'O dia do Senhor',
  option_d = 'A noite do rei',
  correct_answer = 'C'::answer_letter
where book = 'sofonias' and question = 'Qual expressão marca o anúncio de juízo em Sofonias?';

update public.questions set
  option_a = 'Com a queda de Jerusalém sem esperança',
  option_b = 'Com uma guerra no Egito',
  option_c = 'Com promessa de restauração e alegria de Deus sobre seu povo',
  option_d = 'Com a morte do profeta',
  correct_answer = 'C'::answer_letter
where book = 'sofonias' and question = 'Como termina o livro de Sofonias?';

update public.questions set
  option_a = 'Hebrom',
  option_b = 'Nínive',
  option_c = 'Belém',
  option_d = 'Damasco',
  correct_answer = 'B'::answer_letter
where book = 'sofonias' and question = 'Qual cidade é mencionada entre os alvos de juízo no livro?';

update public.questions set
  option_a = 'Destruição total sobre homens, animais, aves e peixes',
  option_b = 'Apenas sobre os sacerdotes',
  option_c = 'Apenas sobre os estrangeiros',
  option_d = 'Somente sobre a Assíria',
  correct_answer = 'A'::answer_letter
where book = 'sofonias' and question = 'Qual é a extensão do juízo anunciado logo no início de Sofonias 1:2-3?';

update public.questions set
  option_a = 'Os pune sem misericórdia',
  option_b = 'Os envia ao exílio',
  option_c = 'Os abandona no deserto',
  option_d = 'Canta sobre eles com júbilo',
  correct_answer = 'D'::answer_letter
where book = 'sofonias' and question = 'O que o Senhor faz por seu povo com alegria, segundo Sofonias 3:17?';

update public.questions set
  option_a = 'Pão fresco',
  option_b = 'Água corrente e pura',
  option_c = 'Ouro refinado',
  option_d = 'Vinho parado sobre as fezes (borra)',
  correct_answer = 'D'::answer_letter
where book = 'sofonias' and question = 'Com o que Sofonias 1:12 compara os que estavam acomodados espiritualmente?';

update public.questions set
  option_a = 'Filístia, Moabe, Amom, Cuxe e Assíria',
  option_b = 'Somente as tribos de Israel',
  option_c = 'Apenas o Egito',
  option_d = 'Apenas Roma e Grécia',
  correct_answer = 'A'::answer_letter
where book = 'sofonias' and question = 'Quais grupos de nações são alvo dos oráculos de juízo em Sofonias 2?';

update public.questions set
  option_a = 'Davi',
  option_b = 'Ezequias',
  option_c = 'Josias, seu contemporâneo',
  option_d = 'Salomão',
  correct_answer = 'B'::answer_letter
where book = 'sofonias' and question = 'Segundo a genealogia em Sofonias 1:1, o profeta é apresentado como descendente de qual rei de Judá?';

update public.questions set
  option_a = 'O palácio do rei',
  option_b = 'A reconstrução do templo',
  option_c = 'A muralha de Jericó',
  option_d = 'A construção de uma frota',
  correct_answer = 'B'::answer_letter
where book = 'ageu' and question = 'Qual obra Ageu incentiva o povo a retomar?';

update public.questions set
  option_a = 'Zorobabel',
  option_b = 'Saul',
  option_c = 'Elias',
  option_d = 'Ezequias',
  correct_answer = 'A'::answer_letter
where book = 'ageu' and question = 'Quem governava Judá como governador no contexto de Ageu?';

update public.questions set
  option_a = 'Josué, filho de Jeozadaque',
  option_b = 'Zadoque',
  option_c = 'Arão',
  option_d = 'Eli',
  correct_answer = 'A'::answer_letter
where book = 'ageu' and question = 'Quem era o sumo sacerdote mencionado junto a Zorobabel?';

update public.questions set
  option_a = 'Não haveria templo',
  option_b = 'A casa seria abandonada',
  option_c = 'A glória desta última casa seria maior que a da primeira',
  option_d = 'O templo seria transferido para o Egito',
  correct_answer = 'C'::answer_letter
where book = 'ageu' and question = 'O que Deus promete em Ageu 2:9 sobre a glória da casa?';

update public.questions set
  option_a = 'A Assíria voltará a governar',
  option_b = 'Zorobabel será coroado rei de todas as nações',
  option_c = 'Tronos serão derrubados e reinos serão destruídos',
  option_d = 'Israel dominará o Egito imediatamente',
  correct_answer = 'C'::answer_letter
where book = 'ageu' and question = 'Qual imagem política aparece em Ageu 2:22?';

update public.questions set
  option_a = 'Dobrava a cada semana',
  option_b = 'Era guardado com segurança',
  option_c = 'Era posto num saco furado',
  option_d = 'Vinha do Egito',
  correct_answer = 'C'::answer_letter
where book = 'ageu' and question = 'O que Ageu 1:6 diz sobre o salário de quem trabalhava enquanto negligenciava o templo?';

update public.questions set
  option_a = 'Esquecerei o templo',
  option_b = 'Eu sou convosco',
  option_c = 'Eu vos abandono',
  option_d = 'Não voltarei mais',
  correct_answer = 'B'::answer_letter
where book = 'ageu' and question = 'O que Deus declarou ao povo depois que eles obedeceram e começaram a reconstrução, segundo Ageu 1:13?';

update public.questions set
  option_a = 'Um novo dilúvio',
  option_b = 'A queda definitiva de Jerusalém',
  option_c = 'O fim dos sacrifícios',
  option_d = 'O Desejado de todas as nações',
  correct_answer = 'D'::answer_letter
where book = 'ageu' and question = 'O que Ageu 2:7 anuncia que virá depois que Deus abalar céus e terra?';

update public.questions set
  option_a = 'O desejo de fugir para o Egito',
  option_b = 'O espírito para trabalharem na casa do Senhor',
  option_c = 'O interesse em construir palácios pessoais',
  option_d = 'A vontade de abandonar Judá',
  correct_answer = 'B'::answer_letter
where book = 'ageu' and question = 'Segundo Ageu 1:14, o que o Senhor despertou em Zorobabel, Josué e no povo?';

update public.questions set
  option_a = 'Uma espada real',
  option_b = 'Uma coroa de ouro',
  option_c = 'Um cetro de ferro',
  option_d = 'Um anel de selar',
  correct_answer = 'D'::answer_letter
where book = 'ageu' and question = 'No versículo final de Ageu (2:23), a que objeto de honra Deus compara Zorobabel?';

update public.questions set
  option_a = 'Fugi para o Egito',
  option_b = 'Voltai para mim, e eu me voltarei para vós',
  option_c = 'Escolham outro rei',
  option_d = 'Não construam o templo',
  correct_answer = 'B'::answer_letter
where book = 'zacarias' and question = 'Qual era a principal mensagem inicial de Zacarias 1:3?';

update public.questions set
  option_a = 'Um peixe gigante',
  option_b = 'Uma arca de Noé',
  option_c = 'Uma coroa de ferro',
  option_d = 'Um rolo voante',
  correct_answer = 'D'::answer_letter
where book = 'zacarias' and question = 'O que Zacarias vê em uma das visões do capítulo 5?';

update public.questions set
  option_a = 'A riqueza do rei',
  option_b = 'A força militar',
  option_c = 'A água do templo',
  option_d = 'A provisão do Espírito de Deus',
  correct_answer = 'D'::answer_letter
where book = 'zacarias' and question = 'Na visão do capítulo 4, o que representa o azeite em relação às duas oliveiras?';

update public.questions set
  option_a = 'O rei da Assíria',
  option_b = 'Um rei justo e salvador',
  option_c = 'O faraó do Egito',
  option_d = 'Nabucodonosor',
  correct_answer = 'B'::answer_letter
where book = 'zacarias' and question = 'Qual rei é descrito chegando a Jerusalém montado em um jumento?';

update public.questions set
  option_a = 'Jerusalém será abandonada para sempre',
  option_b = 'Israel será levado ao Egito',
  option_c = 'Olharão para aquele a quem traspassaram e prantearão',
  option_d = 'Não haverá arrependimento',
  correct_answer = 'C'::answer_letter
where book = 'zacarias' and question = 'Qual expressão aparece em Zacarias 12:10 sobre o futuro arrependimento?';

update public.questions set
  option_a = 'O rei da Babilônia',
  option_b = 'Satanás',
  option_c = 'Um sacerdote rival',
  option_d = 'Um profeta falso',
  correct_answer = 'B'::answer_letter
where book = 'zacarias' and question = 'Na visão de Zacarias 3, quem acusa o sumo sacerdote Josué diante do anjo do Senhor?';

update public.questions set
  option_a = 'Uma nuvem de fogo apenas',
  option_b = 'Um exército de anjos armados',
  option_c = 'Quatro carros puxados por cavalos',
  option_d = 'Uma frota de navios',
  correct_answer = 'C'::answer_letter
where book = 'zacarias' and question = 'O que Zacarias vê saindo dentre dois montes de bronze na visão do capítulo 6?';

update public.questions set
  option_a = 'Tomarão pela orla de sua veste, dizendo que irão com ele',
  option_b = 'Pedirão para adorar outros deuses',
  option_c = 'Ignorarão completamente',
  option_d = 'Expulsarão da cidade',
  correct_answer = 'A'::answer_letter
where book = 'zacarias' and question = 'Segundo Zacarias 8:23, o que dez homens de todas as línguas farão a um judeu?';

update public.questions set
  option_a = 'Trinta',
  option_b = 'Cem',
  option_c = 'Mil',
  option_d = 'Dez',
  correct_answer = 'A'::answer_letter
where book = 'zacarias' and question = 'Por quantas moedas de prata o pastor (representando o Senhor) foi avaliado em Zacarias 11:12?';

update public.questions set
  option_a = 'Monte Sinai',
  option_b = 'Monte Carmelo',
  option_c = 'Monte Nebo',
  option_d = 'Monte das Oliveiras',
  correct_answer = 'D'::answer_letter
where book = 'zacarias' and question = 'Em Zacarias 14:4, onde os pés do Senhor se firmarão, fazendo o monte se fender em duas partes?';

update public.questions set
  option_a = 'Quem é o rei?',
  option_b = 'Quando virá Elias?',
  option_c = 'Onde está Moisés?',
  option_d = 'Em que nos amaste?',
  correct_answer = 'D'::answer_letter
where book = 'malaquias' and question = 'Qual é a primeira pergunta de contestação registrada no diálogo de Malaquias?';

update public.questions set
  option_a = 'Um general romano',
  option_b = 'Um mensageiro que prepararia o caminho',
  option_c = 'Um novo rei assírio',
  option_d = 'Um sacerdote de Samaria',
  correct_answer = 'B'::answer_letter
where book = 'malaquias' and question = 'Quem é prometido como mensageiro antes da chegada do Senhor?';

update public.questions set
  option_a = 'Trazer todos os dízimos à casa do tesouro',
  option_b = 'Usar o dízimo para guerra',
  option_c = 'Entregar somente ao rei',
  option_d = 'Guardar o dízimo em casa',
  correct_answer = 'A'::answer_letter
where book = 'malaquias' and question = 'O que Malaquias 3:10 relaciona ao dízimo?';

update public.questions set
  option_a = 'Jeremias',
  option_b = 'Samuel',
  option_c = 'Elias, o profeta',
  option_d = 'Natã',
  correct_answer = 'C'::answer_letter
where book = 'malaquias' and question = 'O que o final do livro de Malaquias promete enviar antes do grande e terrível dia do Senhor?';

update public.questions set
  option_a = 'Desprezavam o nome de Deus e ofereciam sacrifícios inadequados',
  option_b = 'Não conheciam a Lei de Moisés',
  option_c = 'Construíam muitos altares',
  option_d = 'Recusavam-se a trabalhar no templo',
  correct_answer = 'A'::answer_letter
where book = 'malaquias' and question = 'Qual problema dos sacerdotes é denunciado em Malaquias 2?';

update public.questions set
  option_a = 'Apenas aves selvagens',
  option_b = 'Cegos, coxos e enfermos',
  option_c = 'Peixes do rio Jordão',
  option_d = 'Somente animais gordos e perfeitos',
  correct_answer = 'B'::answer_letter
where book = 'malaquias' and question = 'Que tipo de animais o povo oferecia indevidamente em sacrifício, segundo Malaquias 1:8?';

update public.questions set
  option_a = 'As orações longas',
  option_b = 'Os dízimos',
  option_c = 'Os sacrifícios de louvor',
  option_d = 'O repúdio (divórcio)',
  correct_answer = 'D'::answer_letter
where book = 'malaquias' and question = 'O que Malaquias 2:16 diz que o Senhor aborrece?';

update public.questions set
  option_a = 'Eu esqueço facilmente',
  option_b = 'Eu mudo conforme as nações',
  option_c = 'Eu abandono meu povo',
  option_d = 'Eu, o Senhor, não mudo',
  correct_answer = 'D'::answer_letter
where book = 'malaquias' and question = 'O que Malaquias 3:6 afirma sobre o caráter de Deus que garante que Israel não foi consumido?';

update public.questions set
  option_a = 'Nos sacrifícios de animais',
  option_b = 'Nas orações públicas',
  option_c = 'Nos dízimos e nas ofertas',
  option_d = 'Na construção do templo',
  correct_answer = 'C'::answer_letter
where book = 'malaquias' and question = 'De que forma Malaquias 3:8 diz que o povo estava roubando a Deus?';

update public.questions set
  option_a = 'Não somos todos sacerdotes?',
  option_b = 'Não temos todos um mesmo Pai e um mesmo Criador?',
  option_c = 'Não vivemos todos no Egito?',
  option_d = 'Não somos todos reis?',
  correct_answer = 'B'::answer_letter
where book = 'malaquias' and question = 'Qual argumento de unidade Malaquias 2:10 usa para repreender a traição entre irmãos?';

-- Verificação rápida (opcional):
-- select correct_answer, count(*) from public.questions group by correct_answer order by correct_answer;
