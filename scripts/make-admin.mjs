#!/usr/bin/env node
/**
 * Gera o SQL para criar um administrador no Supabase.
 * ---------------------------------------------------------------------------
 * Uso:
 *   node scripts/make-admin.mjs --nickname "SeuApelido" --name "Seu Nome" [--token MEU_TOKEN]
 *
 * Saída:
 *   • INSERT do usuário com role = 'admin'
 *   • INSERT em admin_tokens com o hash SHA-256 do token informado
 *
 * O token gerado (ou informado) é o que você usa no campo de login da área
 * /admin e no cabeçalho Authorization: Bearer <token> das chamadas /api/admin.
 * Alternativa simples (v1.0): definir ADMIN_TOKEN no backend — veja o README.
 */
import crypto from 'node:crypto';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const nickname = arg('nickname') || 'admin';
const name = arg('name') || 'Administrador do Quiz';
const token = arg('token') || crypto.randomBytes(24).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
const userId = crypto.randomUUID();

console.log(`-- Administrador: ${name} (${nickname})
-- Token de acesso (guarde com carinho): ${token}

insert into public.users (id, name, nickname, role)
values ('${userId}', '${name.replace(/'/g, "''")}', '${nickname.replace(/'/g, "''")}', 'admin')
on conflict do nothing;

insert into public.admin_tokens (user_id, token_hash, expires_at)
values ('${userId}', '${tokenHash}', '${expiresAt}');
`);

console.log('Cole o SQL acima no SQL Editor do Supabase (ou execute via psql).');
console.log('Depois, entre em /admin no frontend e informe o token exibido.');
