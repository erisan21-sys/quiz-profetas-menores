# Arquitetura — Quiz Bíblico — Profetas Menores v1.0

## 1. Fluxo geral

```
CELULAR / COMPUTADOR  (React + Vite + PWA)
        ↓  HTTPS (JSON)
BACKEND / API  (Node.js + Express)   ← única autoridade de pontuação
        ↓  (service_role key)
SUPABASE  →  POSTGRESQL
```

O navegador **não é autoridade** sobre: respostas corretas, pontuação, ranking, percentual,
duração oficial e resultado final. Ele envia apenas `attempt_id`, `question_id` e
`selected_answer`; tudo o mais é calculado/validado no servidor e gravado no banco.

## 2. Camadas do backend

| Camada        | Arquivos                  | Responsabilidade |
| ------------- | ------------------------- | ---------------- |
| HTTP/segurança| `app.js`, `middleware/*`  | helmet, CORS, rate limit, sessão HMAC, erros |
| Rotas         | `routes/*`                | contratos da API e validação de entrada |
| Serviços      | `services/*`              | regras de negócio puras (pontuação, conquistas) |
| Regras        | `utils/rules.js`          | pontos, bônus, percentual, sanitização (fonte única) |
| Persistência  | `db/*`                    | interface de repositório com 2 drivers |

### Drivers de banco

* `supabaseRepo.js` — produção: PostgREST + RPCs SQL (`leaderboard`, `player_rank`,
  `global_stats`, `player_stats`).
* `localRepo.js` — desenvolvimento/testes: mesma interface, memória + JSON.
  Os testes de integração sobem o **app HTTP real** contra este driver.

## 3. Ciclo de uma partida

1. `POST /api/quiz/start` — sorteia 20 questões (6/8/6), grava `question_order` (JSON) e
   devolve as questões **sem gabarito**.
2. `POST /api/quiz/answer` — valida dono, status `STARTED`, pertinência, **ordem sorteada**,
   duplicidade e cadência mínima; compara com o gabarito no servidor; grava `quiz_answers`
   e atualiza contadores da partida.
3. `POST /api/quiz/finish` — recalcula tudo a partir das respostas gravadas (nunca confia nos
   contadores do cliente), define `FINISHED`, duração pelo relógio do servidor, bônus de
   aproveitamento, posição no ranking e conquistas desbloqueadas.
4. A partida `FINISHED` torna-se **imutável** (constraint + trigger no banco).

## 4. Anti-fraude (defesa em profundidade)

1. Gabarito nunca sai antes da resposta (`publicQuestion()` remove `correct_answer`/`explanation`).
2. Ordem sorteada por partida + verificação de posição (audita violações em `audit_log`).
3. `unique(attempt_id, question_id)` impede resposta duplicada no banco.
4. Trigger `protect_answer_insert`: só partida `STARTED`, só o dono, só a questão da vez.
5. Trigger `protect_finished_attempt`: resultado imutável após o fim.
6. Cadência mínima entre respostas (`MIN_ANSWER_INTERVAL_MS`) contra macros.
7. Payloads com campos injetados (`is_correct`, `score`, `points`, `percentage`) são ignorados.
8. Rate limits por IP/sessão em todos os fluxos (geral, cadastro, start, answer, admin).
9. RLS: anon não escreve em nenhuma tabela; leituras públicas só do que é público.
10. `service_role key` e `ADMIN_TOKEN` vivem apenas no backend.

## 5. Identidade e sessão (v1.0 → v1.2)

* v1.0: cadastro por nome/apelido; o servidor emite token `v1.<userId>.<iat>.<exp>.<hmac>`
  (HMAC-SHA256 com `TOKEN_SECRET`). Sem senha.
* v1.2 (preparado): colunas `users.email` e `users.auth_id` já existem; policies sugeridas
  para `auth.uid()` estão comentadas em `database/rls.sql`. A troca é localizada em
  `middleware/auth.js` + `utils/token.js`.

## 6. Ranking

Calculado por `leaderboard()` no PostgreSQL (e espelhado no driver local):
agrega a **melhor partida** por jogador no período/modo e ordena por
`score desc, percentage desc, correct_answers desc, finished_at desc`.
Períodos: hoje/semana/mês/geral · Modos: todas/fácil/médio/difícil.

## 7. PWA e offline

* `manifest.webmanifest` + ícones (any/maskable) + splash por `background_color`.
* `sw.js`: assets em cache-first, navegação e `GET /api` em network-first com fallback.
* Offline: interface e leituras continuam funcionando; **pontuação offline não existe** —
  o frontend enfileira respostas/finish localmente (`pendingQueueStore`) e sincroniza ao
  reconectar, respeitando a ordem e a cadência do servidor. Falhas de sincronização avisam
  o usuário e mantêm a fila.

## 8. Roadmap suportado pela arquitetura

| Versão | Mudança prevista | Onde encostar |
| ------ | ---------------- | ------------- |
| v1.2 | Auth Supabase (e-mail/Google) | `users.auth_id`, `rls.sql`, `middleware/auth.js` |
| v1.3 | Quiz diário | `quiz_attempts.mode` + nova rota `/api/daily` |
| v1.4 | Desafios 1×1 | nova tabela `challenges` + service |
| v1.5 | Grupos | tabela `groups` + filtro no `leaderboard()` |
| v2.0 | Multiplayer tempo real | WebSocket/SSE sobre `quiz_attempts` |

Nada disso foi implementado agora — apenas deixamos espaço limpo (campos, enums e policies).
