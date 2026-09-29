# Supabase — banco, RLS, administrador e backup

## 1. Criação do projeto

1. <https://supabase.com> → **New project** (região próxima: `sa-east-1` quando disponível).
2. Guarde a senha do banco e aguarde o provisionamento.

## 2. Aplicar o esquema (SQL Editor, nesta ordem)

1. `database/schema.sql`
   * enums (`question_difficulty`, `answer_letter`, `attempt_status`, `quiz_mode`, `user_role`);
   * tabelas `users`, `questions`, `quiz_attempts`, `quiz_answers`, `achievements`,
     `user_achievements`, `admin_tokens`, `audit_log`;
   * chaves estrangeiras com `on delete cascade/restrict`;
   * índices (ranking, histórico, respostas) e constraints (pontuação ≥ 0, percentual 0–100,
     alternativas distintas, `unique(attempt_id, question_id)`);
   * triggers:
     * `set_updated_at` (timestamps);
     * `protect_finished_attempt` — **partida FINISHED/ABANDONED é imutável**;
     * `protect_answer_insert` — resposta só em partida STARTED, do dono, na ordem sorteada;
   * funções de leitura agregada: `leaderboard()`, `player_rank()`, `global_stats()`,
     `player_stats()`.
2. `database/seed.sql` — 60 perguntas (5 por profeta) + 7 conquistas.
   Idempotente (`on conflict do nothing`).
3. `database/rls.sql` — habilita RLS em todas as tabelas e cria as policies públicas.

## 3. Modelo de segurança (RLS)

| Tabela             | anon/authenticated                     | service_role |
| ------------------ | -------------------------------------- | ------------ |
| `questions`        | SELECT apenas de ativas                | tudo |
| `users`            | SELECT apenas de `share_profile=true`  | tudo |
| `quiz_attempts`    | SELECT apenas de `FINISHED` públicas   | tudo |
| `quiz_answers`     | SELECT apenas de partidas `FINISHED`   | tudo |
| `achievements`     | SELECT                                  | tudo |
| `user_achievements`| SELECT (perfis públicos)                | tudo |
| `admin_tokens`     | **nenhum acesso**                       | tudo |
| `audit_log`        | **nenhum acesso**                       | tudo |

Consequência prática: mesmo que a `anon key` vaze, **não existe caminho para alterar
pontuação pelo banco**. Toda escrita passa pela API, que usa a `service_role key`
(exclusiva do backend) e revalida tudo em `services/quizService.js`.

> O gabarito (`correct_answer`, `explanation`) nunca é enviado pelo backend antes da resposta:
> as rotas públicas montam as questões com `publicQuestion()`, que remove esses campos.

## 4. Chaves

* **Project Settings → API**
  * `SUPABASE_URL` = Project URL
  * `SUPABASE_SERVICE_ROLE_KEY` = `service_role` → **somente no backend** (`backend/.env`,
    variáveis do Render/Railway). Nunca no frontend, nunca no repositório.
  * `SUPABASE_ANON_KEY` = `anon` → informativa na v1.0 (o frontend só fala com a API).

## 5. Criar o administrador

**Opção A — token de configuração (v1.0):** defina `ADMIN_TOKEN` no backend. Nada a fazer no
banco.

**Opção B — registro em banco:**

```bash
npm run make-admin -- --nickname "MeuApelido" --name "Meu Nome"
# opcional: --token MEU_TOKEN_SENHA_FORTE
```

O script imprime dois `INSERT` (usuário `role='admin'` + hash SHA-256 do token em
`admin_tokens`, com expiração de 1 ano). Cole no SQL Editor e use o token impresso na tela
`/admin`.

Para rotacionar: exclua a linha de `admin_tokens` e gere outra.

## 6. Backup e restauração

```bash
# exportação completa (esquema + dados)
pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%F).dump

# restauração
pg_restore --clean --if-exists -d "$DATABASE_URL" backup-2026-09-02.dump

# apenas dados (CSV) de uma tabela
psql "$DATABASE_URL" -c "\copy public.quiz_attempts TO 'attempts.csv' CSV HEADER"
```

* Backups automáticos: Dashboard → Database → Backups (planos pagos) — restaure por PITR.
* O `schema.sql` + `seed.sql` versionados garantem recriar a estrutura a qualquer momento.
* Antes de mudanças de esquema: dump → aplicar migração → dump de conferência.

## 7. Evolução do esquema (v1.2+)

* Login por e-mail/Google: use `auth.users` do Supabase e ligue `users.auth_id`
  (coluna já existente). As policies sugeridas estão comentadas no final de `database/rls.sql`.
* Novas conquistas: `INSERT` em `achievements` com `criteria` JSON — o motor de regras
  (`services/achievementService.js`) já interpreta `attempts_count`, `perfect_attempt`,
  `leaderboard_position`, `accuracy` e `expert`.
