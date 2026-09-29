# Referência da API — Quiz Bíblico — Profetas Menores v1.0

Base: `/api` · Respostas sempre em JSON · Erros: `{ "error": "mensagem", "details": ... }`

**Autenticação do jogador:** cabeçalho `Authorization: Bearer <token>` obtido em `POST /users`
(ou `/users/rejoin`). O token é assinado (HMAC-SHA256) pelo servidor.

**Autenticação administrativa:** `Authorization: Bearer <ADMIN_TOKEN>` (ou token registrado em
`admin_tokens`).

---

## Saúde e metadados

| Método | Rota          | Descrição                                  |
| ------ | ------------- | ------------------------------------------ |
| GET    | `/api`        | lista de endpoints                          |
| GET    | `/api/health` | status + driver + contagens                 |

## Jogadores

| Método | Rota                      | Auth | Descrição |
| ------ | ------------------------- | ---- | --------- |
| POST   | `/api/users`              | —    | cadastro simples `{name, nickname}` → `{user, token, expires_at}` |
| POST   | `/api/users/rejoin`       | —    | recupera sessão pelo apelido `{nickname}` |
| GET    | `/api/users/me/profile`   | ✅   | perfil + estatísticas + conquistas + histórico do jogador logado |
| GET    | `/api/users/me/achievements` | ✅ | conquistas do jogador |
| PATCH  | `/api/users/me`           | ✅   | `{name?, share_profile?}` |
| DELETE | `/api/users/me?mode=anonymize\|delete` | ✅ | exclusão/anonimização |
| GET    | `/api/users/:id`          | —    | perfil público (403 se `share_profile=false` e não for o dono) |
| GET    | `/api/users/:id/history`  | —    | histórico (mesma regra de privacidade) |

## Jogo (autoridade do servidor)

| Método | Rota               | Auth | Descrição |
| ------ | ------------------ | ---- | --------- |
| GET    | `/api/quiz/rules`  | —    | tabela pública de pontuação/bônus |
| POST   | `/api/quiz/start`  | ✅   | `{mode?: "mixed"\|"facil"\|"medio"\|"dificil"}` → partida + questões **sem gabarito**; se houver partida aberta, retorna `resumed: true` |
| POST   | `/api/quiz/answer` | ✅   | `{attempt_id, question_id, selected_answer}` → `{is_correct, points_earned, progress, reveal}` (gabarito e explicação só depois da resposta) |
| POST   | `/api/quiz/finish` | ✅   | `{attempt_id}` → resultado oficial + rank + conquistas + mensagem de compartilhamento + revisão |

### Validações de `/api/quiz/answer`

* partida existe, pertence ao jogador e está `STARTED`;
* questão pertence à ordem sorteada da partida;
* questão é **exatamente a da vez** (ordem obrigatória);
* questão ainda não respondida (`409` caso contrário; constraint no banco é a garantia final);
* cadência mínima entre envios (`MIN_ANSWER_INTERVAL_MS`, padrão 1200 ms) → `429`;
* campos extras no payload (`is_correct`, `score`, `points`…) são **ignorados**.

## Partidas

| Método | Rota                     | Auth | Descrição |
| ------ | ------------------------ | ---- | --------- |
| GET    | `/api/attempts/public`   | —    | histórico público (apelido, pontos, acertos, %, data) |
| GET    | `/api/attempts/:id`      | opc. | detalhe; revisão com gabarito apenas para partidas `FINISHED` ou para o dono |

## Ranking

| Método | Rota                                  | Descrição |
| ------ | ------------------------------------- | --------- |
| GET    | `/api/ranking?period=&difficulty=`    | `period`: `all\|today\|week\|month` (aceita `geral\|hoje\|semana\|mes`) · `difficulty`: `all\|facil\|medio\|dificil` |
| GET    | `/api/ranking/today` · `/week` · `/month` · `/all` | atalhos de período |
| GET    | `/api/ranking/me`                     | ✅ posição, total de jogadores e percentual superado |

Ordenação (no banco, nunca no cliente): **pontos → percentual → acertos → recência**.

## Estatísticas e catálogo

| Método | Rota                     | Descrição |
| ------ | ------------------------ | --------- |
| GET    | `/api/stats`             | dashboard público (totais, médias, pergunta mais acertada/errada, últimos resultados) |
| GET    | `/api/stats/attempts`    | últimas partidas finalizadas |
| GET    | `/api/stats/achievements`| catálogo de conquistas |
| GET    | `/api/questions`         | catálogo público **sem gabarito** (+ distribuição por dificuldade) |

## Admin (`/api/admin/*`)

| Método | Rota                        | Descrição |
| ------ | --------------------------- | --------- |
| GET    | `/admin/overview`           | dashboard + distribuição de questões + últimos cadastros/partidas |
| GET    | `/admin/users`              | usuários com agregados (`?search=&limit=&offset=`) |
| PATCH  | `/admin/users/:id/role`     | `{role: "admin"\|"player"}` |
| DELETE | `/admin/users/:id?mode=`    | `anonymize` ou `delete` |
| GET    | `/admin/questions`          | todas as questões (com gabarito) |
| POST   | `/admin/questions`          | cria questão (validação completa) |
| PUT    | `/admin/questions/:id`      | edição parcial (ex.: só `difficulty`) |
| DELETE | `/admin/questions/:id`      | remove; se já respondida, **desativa** preservando histórico |
| GET    | `/admin/attempts`           | partidas (`?status=&user_id=`) |
| GET    | `/admin/ranking`            | ranking completo por período/dificuldade |
| GET    | `/admin/stats`              | estatísticas |
| GET    | `/admin/health`             | saúde do banco |

## Rate limit

Todos os endpoints passam por limitadores por IP/sessão: geral (`RATE_MAX`), cadastro
(`RATE_MAX_AUTH`), criação de partidas (`RATE_MAX_START`), respostas (`RATE_MAX_ANSWER`) e
admin (`RATE_MAX_ADMIN`). Resposta `429` inclui `retry_after_seconds`.

## Códigos de erro comuns

| Código | Quando |
| ------ | ------ |
| 400 | payload inválido / IDs malformados |
| 401 | sem sessão ou sessão inválida/expirada |
| 403 | partida/perfil de outro jogador · credencial admin inválida · perfil privado |
| 404 | recurso inexistente |
| 409 | apelido duplicado · resposta duplicada · partida encerrada · ordem violada |
| 429 | rate limit ou cadência mínima entre respostas |
