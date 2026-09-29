import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config, { assertConfig } from './config/index.js';
import { createApp, ensureSeedData } from './app.js';
import { MIXED_DISTRIBUTION, setMixedDistribution, sumDistribution } from './utils/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ponto de entrada do backend.
 *   DB_DRIVER=supabase -> produção (Supabase/PostgreSQL)
 *   DB_DRIVER=local    -> desenvolvimento/testes (memória + JSON)
 */
/** Aplica QUIZ_SIZE e QUIZ_DISTRIBUTION (opcional) às regras do jogo. */
function applyGameRules() {
  if (!config.game.quizDistribution) return;
  const { total } = setMixedDistribution(config.game.quizDistribution);
  if (total !== config.game.quizSize) {
    // eslint-disable-next-line no-console
    console.warn(
      `[regras] QUIZ_DISTRIBUTION soma ${total} questões, mas QUIZ_SIZE é ${config.game.quizSize}. ` +
        'A distribuição padrão 6/8/6 foi restaurada.',
    );
    setMixedDistribution();
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[regras] distribuição personalizada: ${MIXED_DISTRIBUTION.facil} fáceis, ` +
      `${MIXED_DISTRIBUTION.medio} médias, ${MIXED_DISTRIBUTION.dificil} difíceis.`,
  );
}

async function main() {
  assertConfig();
  applyGameRules();

  // Em produção ou monolito, serve o build do frontend se ele existir.
  const distCandidates = [
    process.env.STATIC_DIR,
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, '../public'),
  ].filter(Boolean);

  let staticDir = null;
  for (const dir of distCandidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
      staticDir = dir;
      break;
    }
  }

  const app = createApp({ staticDir });

  // Sem TOKEN_SECRET informado em modo local: gera um segredo efêmero.
  if (!config.security.tokenSecret) {
    const { devSecret } = await import('./config/index.js');
    config.security.tokenSecret = devSecret();
    // eslint-disable-next-line no-console
    console.warn('[segurança] TOKEN_SECRET não definido — usando segredo efêmero (apenas desenvolvimento).');
  }

  const seedInfo = await ensureSeedData(app.locals.repo).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] falha ao carregar conteúdo inicial:', err.message);
    return null;
  });

  if (config.db.driver === 'supabase' && seedInfo && seedInfo.questions === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[seed] Nenhuma questão ativa encontrada no Supabase. Execute database/schema.sql, ' +
        'database/seed.sql e database/rls.sql no SQL Editor.',
    );
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  QUIZ BÍBLICO — PROFETAS MENORES · API v1.0                        ║
╚══════════════════════════════════════════════════════════╝
  ➜ ambiente : ${config.env}
  ➜ driver   : ${config.db.driver}
  ➜ porta    : ${config.port}
  ➜ saúde    : http://localhost:${config.port}/api/health
  ➜ rotas    : http://localhost:${config.port}/api
${seedInfo ? `  ➜ conteúdo : ${seedInfo.questions} questões · ${seedInfo.achievements ?? 0} conquistas` : ''}
${staticDir ? `  ➜ frontend : ${staticDir}` : ''}
`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} recebido, encerrando...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[server] unhandledRejection:', reason);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] falha ao iniciar:', err.message);
  process.exit(1);
});
