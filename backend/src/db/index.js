import config from '../config/index.js';
import { createLocalRepo } from './localRepo.js';
import { createSupabaseRepo } from './supabaseRepo.js';

/**
 * Seleciona o driver de dados.
 *   DB_DRIVER=supabase -> PostgreSQL via Supabase (produção)
 *   DB_DRIVER=local    -> memória + JSON (desenvolvimento e testes)
 */
export function createRepo(overrides = {}) {
  const driver = (overrides.driver || config.db.driver || 'local').toLowerCase();

  if (driver === 'supabase' && config.db.supabaseUrl && config.db.supabaseServiceKey) {
    return createSupabaseRepo({
      url: config.db.supabaseUrl,
      serviceKey: config.db.supabaseServiceKey,
    });
  }

  if (driver === 'supabase') {
    // eslint-disable-next-line no-console
    console.warn(
      '[db] DB_DRIVER=supabase informado, mas SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente. ' +
        'Usando driver local.',
    );
  }

  return createLocalRepo({ file: driver === 'local' ? config.db.localFile : null });
}

export { createLocalRepo, createSupabaseRepo };
export default createRepo;
