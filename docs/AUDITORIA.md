# Auditoria da versão — Profetas Menores

## Alterações principais

- Daniel removido do conteúdo e da interface.
- Criado catálogo dos 12 Profetas Menores.
- Banco ampliado de 60 para **120 perguntas — 10 por profeta** (mantendo as 60 originais intactas e somando 60 novas).
- Seleção individual por profeta no servidor.
- Modo geral preserva a partida de 20 perguntas com distribuição 6/8/6.
- Banco recebeu os campos `book` e `book_name`; partidas receberam `prophet`.
- PWA, ranking, histórico, estatísticas, conquistas e administração foram preservados.

## Verificação executada

- Banco de questões carregado: 120 questões.
- 12 profetas encontrados: 10 questões por profeta (4 fáceis, 4 médias, 2 difíceis).
- Seleção individual por partida: as 10 questões do profeta (4 fáceis, 4 médias, 2 difíceis).
- Seleção geral validada: 20 questões (6 fáceis, 8 médias, 6 difíceis).
- Suíte completa de testes executada: 84/84 passando.
- Build de produção do frontend executado com sucesso (`npm run build`).

## Atualização — banco ampliado para 480 perguntas + correção de repetição

- Corrigido bug de repetição: `startAttempt` (backend) agora só reaproveita uma
  partida em andamento (`STARTED`) se ela for do **mesmo modo e do mesmo
  profeta** solicitados; caso contrário a partida antiga é marcada como
  `ABANDONED` e uma nova é criada. Antes, `getActiveAttempt` ignorava
  `mode`/`prophet` e podia devolver sempre a mesma ordem de perguntas de uma
  partida esquecida de outro profeta/modo, dentro do TTL de 4h.
- Banco ampliado de 120 para **480 perguntas — 40 por profeta** (16 fáceis +
  16 médias + 8 difíceis), mantendo as 120 perguntas originais intactas e
  somando 360 novas (30 por profeta).
- Quiz individual por profeta passa a sortear **20 das 40** perguntas do
  livro, em ordem embaralhada a cada partida (distribuição 8 fáceis + 8
  médias + 4 difíceis), em vez de sempre mostrar as mesmas 10 perguntas
  fixas.
- Quiz geral ("todos os 12") inalterado: 20 perguntas por partida, com
  distribuição 6 fáceis + 8 médias + 6 difíceis — apenas passa a sortear de
  um banco maior.
- Resposta certa das 360 perguntas novas rebalanceada entre A/B/C/D por
  shuffle estratificado; o banco completo de 480 fica com exatamente 120
  respostas certas em cada letra.
- Nenhum usuário, ranking, histórico de partidas ou conquista foi alterado.

### Verificação executada

- Banco de questões carregado: 480 questões, 40 por profeta (16/16/8).
- Distribuição de resposta certa no banco completo: A=120, B=120, C=120, D=120.
- Seleção individual por partida: 20 questões por profeta (8 fáceis, 8
  médias, 4 difíceis), em ordem embaralhada.
- Seleção geral validada: 20 questões (6 fáceis, 8 médias, 6 difíceis).
- Teste manual: iniciar partida do profeta A, trocar para o profeta B sem
  terminar, e voltar ao profeta A — confirma que cada troca gera uma partida
  nova com conteúdo correto (sem vazar perguntas do profeta anterior) e que
  o conjunto de 20 perguntas sorteadas muda a cada nova partida.
- Suíte completa de testes executada: 84/84 passando.
