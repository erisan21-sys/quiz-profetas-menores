# Testes — como rodar e o que é coberto

```bash
cd backend
npm test                 # suíte completa (node:test, sem dependências externas)
npm run test:watch       # modo watch
```

A suíte sobe o **aplicativo Express real** (mesmas rotas, middlewares e serviços da produção)
contra o repositório local e faz requisições HTTP de verdade — ou seja, testa o contrato da
API, não apenas funções isoladas.

## test/rules.test.js — regras oficiais (34 testes)

* pontos por dificuldade (100/200/300) e ausência de pontuação negativa;
* bônus de aproveitamento (100% → +500 · 90–99% → +300 · 80–89% → +150 · <80% → 0);
* gabarito perfeito = 4.000 + 500 = 4.500;
* 18/20 com diferentes níveis de erro (4.100 / 3.900 / 3.700) e 16/20 (bônus +150);
* percentual com 2 casas e teto de 100%;
* duração oficial pelo relógio do servidor, com teto configurável;
* distribuição oficial 6/8/6 = 20 e `QUIZ_DISTRIBUTION` configurável;
* seleção de questões (sem repetição, sem inativas, erro claro com banco incompleto);
* sanitização/XSS, validação de cadastro, normalizações, formatação pt-BR;
* conquistas (critérios por tipo) e token HMAC (adulteração, segredo errado, expiração);
* mensagem de compartilhamento no formato especificado.

## test/api.test.js — integração HTTP (50 testes)

| Grupo | Casos |
| ----- | ----- |
| Saúde/meta | `/api/health`, listagem de endpoints |
| Cadastro | criação com UUID+token, nome curto, apelido inválido, XSS, duplicado (409), case-insensitive, rejoin |
| Sessão | rotas protegidas sem token / token inválido (401) |
| Início | 20 questões 6/8/6, **nenhum gabarito/explicação no payload**, modo por dificuldade, retomada de partida aberta |
| Respostas | correta (pontos por nível), incorreta (zero), **duplicada (409)**, fora de ordem (409), questão estranha (400 + auditoria), letra inválida (400), partida alheia (403 + auditoria), **anti-macro (429)** |
| Finalização | partida completa com placar oficial, 100% = 4.500 + conquistas, sem respostas → ABANDONED, **imutabilidade ao repetir o finish** |
| Manipulação | payload com `is_correct/points/score` injetados é ignorado; finish com campos adulterados não muda nada; update direto no banco é bloqueado; finish de partida alheia (403 + auditoria) |
| Ranking | ordenação por pontos/percentual/acertos/recência, melhor partida por jogador, desempate por recência, períodos + dificuldade, `/ranking/me` |
| Histórico | próprio (data/pontos/duração), público (só apelido+resultado), detalhe com revisão, partida em andamento não pública |
| Perfil | posição, recordes, médias, evolução, conquistas, `/users/me/profile` |
| Conquistas | acumulação em 5 partidas, catálogo público |
| Estatísticas | dashboard público, catálogo sem gabarito, regras publicadas |
| Admin | 401 sem token, 403 token errado, 403 token de jogador; CRUD de questões (validações 400), usuários/partidas/ranking, promoção de papel |
| Privacidade | ocultar perfil sai do ranking e das listas públicas; dono continua acessando; exclusão anonimizadora e exclusão total |
| Rate limit | excesso de cadastros → 429 |

## Cobrindo o fluxo no navegador (checklist manual)

1. Cadastrar → jogar 20 questões → ver feedback por questão com explicação e fonte.
2. Resultado: números, posição, “superou X%”, compartilhar/copiar, revisão.
3. Ranking: filtros HOJE/SEMANA/MÊS/GERAL e TODAS/FÁCIL/MÉDIO/DIFÍCIL.
4. Histórico: abrir partida anterior com gabarito.
5. Perfil: gráfico de evolução + conquistas + privacidade + exclusão.
6. `/admin`: token → visão geral, criar/editar/excluir pergunta, usuários, partidas.
7. PWA: DevTools → Application → Manifest e “Install app”; testar offline (Network offline)
   e confirmar o aviso e a fila de sincronização.
