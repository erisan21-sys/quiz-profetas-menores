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
