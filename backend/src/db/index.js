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

  if (driver === 'supabase') {
    return createSupabaseRepo({
      url: config.db.supabaseUrl,
      serviceKey: config.db.supabaseServiceKey,
    });
  }

  return createLocalRepo({ file: driver === 'local' ? config.db.localFile : null });
}

export { createLocalRepo, createSupabaseRepo };
export default createRepo;
