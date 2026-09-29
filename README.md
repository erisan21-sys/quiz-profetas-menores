# 📖 QUIZ BÍBLICO — PROFETAS MENORES

Novo projeto criado a partir da arquitetura do projeto anterior, mas **separado do original** e com **Daniel removido**.

## Conteúdo

Os 12 Profetas Menores:

1. Oséias
2. Joel
3. Amós
4. Obadias
5. Jonas
6. Miquéias
7. Naum
8. Habacuque
9. Sofonias
10. Ageu
11. Zacarias
12. Malaquias

O banco inicial contém **60 perguntas — 5 para cada profeta**.

- Quiz individual: 5 perguntas do profeta escolhido.
- Quiz geral: 20 perguntas, com distribuição 6 fáceis + 8 médias + 6 difíceis.
- Pontuação calculada no servidor.
- Ranking, histórico, estatísticas e conquistas.
- Área administrativa para gerenciar perguntas e jogadores.
- PWA instalável no Android.
- Backend Node.js/Express.
- Frontend React/Vite.
- Banco local JSON para desenvolvimento/testes.
- Supabase/PostgreSQL para produção.

## Estrutura

```text
quiz-profetas-menores/
├── backend/
├── frontend/
├── database/
├── docs/
├── scripts/
├── package.json
└── README.md
```

## Rodar localmente

Requisitos: Node.js 20+ e npm.

```bash
npm run setup
npm run dev:backend
npm run dev:frontend
```

O backend local usa `DB_DRIVER=local` por padrão.

## Banco Supabase

Para produção:

1. Execute `database/schema.sql`.
2. Execute `database/seed.sql`.
3. Execute `database/rls.sql`.
4. Configure as variáveis do `backend/.env.example`.
5. Use `DB_DRIVER=supabase`.

## Deploy

O projeto mantém a separação usada pela arquitetura original:

- Frontend: Vercel, Netlify ou outro host estático compatível com Vite.
- Backend: Render, Railway ou outro host Node.js.
- Banco: Supabase/PostgreSQL.

O arquivo `render.yaml` já contém um blueprint para o backend.

## Observação importante

Este ZIP é uma **nova cópia do projeto**. O projeto original `quiz-daniel` não é alterado por estes arquivos.
