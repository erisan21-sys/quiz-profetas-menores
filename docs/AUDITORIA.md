# Auditoria da versão — Profetas Menores

## Alterações principais

- Daniel removido do conteúdo e da interface.
- Criado catálogo dos 12 Profetas Menores.
- 60 perguntas iniciais, 5 por profeta.
- Seleção individual por profeta no servidor.
- Modo geral preserva a partida de 20 perguntas com distribuição 6/8/6.
- Banco recebeu os campos `book` e `book_name`; partidas receberam `prophet`.
- PWA, ranking, histórico, estatísticas, conquistas e administração foram preservados.

## Verificação executada

- Banco de questões carregado: 60 questões.
- 12 profetas encontrados: 5 questões por profeta.
- Seleção individual validada: 5 questões (2 fáceis, 2 médias, 1 difícil).
- Seleção geral validada: 20 questões (6 fáceis, 8 médias, 6 difíceis).
- Testes unitários de regras executados: 34/34 passando.
- Build completo do frontend não foi executado neste ambiente porque a instalação das dependências npm não foi concluída dentro do ambiente de execução.
