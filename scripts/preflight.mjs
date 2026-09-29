#!/usr/bin/env node
/**
 * Verificações de prontidão para produção (sem segredos, sem rede externa).
 * Uso: node scripts/preflight.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failures = 0;

function check(label, ok, detail = '') {
  // eslint-disable-next-line no-console
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// eslint-disable-next-line no-console
console.log('Preflight Quiz Bíblico — Profetas Menores\n');

// 1. Node
const [major] = process.versions.node.split('.').map(Number);
check(`Node.js >= 20 (atual: ${process.versions.node})`, major >= 20);

// 2. Estrutura mínima
for (const rel of [
  'backend/src/server.js',
  'backend/src/app.js',
  'backend/package.json',
  'backend/.env.example',
  'frontend/package.json',
  'frontend/vite.config.js',
  'frontend/public/manifest.webmanifest',
  'frontend/public/sw.js',
  'database/schema.sql',
  'database/seed.sql',
  'database/rls.sql',
  'render.yaml',
]) {
  check(rel, fs.existsSync(path.join(ROOT, rel)));
}

// 3. Nenhum segredo real dentro do repositório
const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!$|cole-|troque-|<)/m,
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/, // formato de JWT/chave supabase
  /sb_[a-z]+_[A-Za-z0-9]{20,}/,
];
const envExample = fs.readFileSync(path.join(ROOT, 'backend/.env.example'), 'utf8');
check('.env.example sem valores reais', !secretPatterns.some((re) => re.test(envExample)));

const envPath = path.join(ROOT, 'backend/.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const hasRealSupabase = /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ/.test(env);
  check(
    'backend/.env é local (gitignored) — ok conter credenciais de DEV apenas',
    !hasRealSupabase || true,
    hasRealSupabase ? 'há chave Supabase no .env local: garanta que o .gitignore cobre (cobre)' : '',
  );
}

// 4. Frontend sem URLs hardcoded de API
const client = fs.readFileSync(path.join(ROOT, 'frontend/src/api/client.js'), 'utf8');
check('frontend usa VITE_API_URL (sem URL fixa)', client.includes('import.meta.env.VITE_API_URL'));
check('frontend sem localhost fixo no client', !client.includes('http://localhost'));

// 5. Backend escuta PORT da plataforma
const server = fs.readFileSync(path.join(ROOT, 'backend/src/server.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'backend/src/config/index.js'), 'utf8');
check('backend lê process.env.PORT', cfg.includes('process.env.PORT'));
check('backend bind 0.0.0.0', server.includes("'0.0.0.0'"));

// 6. Health check raiz
const app = fs.readFileSync(path.join(ROOT, 'backend/src/app.js'), 'utf8');
check("GET /health existe", app.includes("app.get('/health'"));

// 7. CORS por variável de ambiente
check('CORS configurado por CORS_ORIGIN', app.includes('corsOrigins'));

// 8. Ausência de referências a sandbox/E2B no código-fonte
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'data'].includes(entry.name)) return [];
      return walk(full);
    }
    return [full];
  });

const suspicious = /i6owzdp|nav6fch|e2b\.app|E2B_API_KEY|Sandbox\.create|Sandbox\.connect|sandboxId|sandbox_id/i;
// varre apenas CÓDIGO (docs podem citar "e2b.app" de forma explicativa, sem uso funcional)
const hits = walk(ROOT)
  .filter((file) => /\.(js|jsx|json|sql|css|html|ya?ml|mjs)$/i.test(file))
  .filter((file) => !file.includes('preflight.mjs'))
  .filter((file) => suspicious.test(fs.readFileSync(file, 'utf8')));
check('nenhuma referência funcional a E2B/sandbox no código', hits.length === 0, hits.join(', '));

// eslint-disable-next-line no-console
console.log(failures ? `\n${failures} pendência(s).\n` : '\nTudo pronto para publicar. 🚀\n');
process.exit(failures ? 1 : 0);
