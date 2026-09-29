import { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../lib/router.jsx';

/**
 * Cadastro simples da v1.0: nome/apelido (sem senha).
 * Também permite recuperar a sessão pelo apelido ("Já tenho cadastro").
 * A arquitetura já prevê e-mail/senha/Google na v1.2.
 */
export function RegisterPage({ params }) {
  const { register, rejoin, notify } = useApp();
  const next = params.get('next') || '/';

  const [mode, setMode] = useState('new');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setBusy(true);
    try {
      if (mode === 'new') {
        await register({ name, nickname });
        notify('Bem-vindo ao Quiz dos Profetas Menores! ', 'success');
      } else {
        await rejoin(nickname);
        notify('Sessão recuperada. Bom jogo! 🎯', 'success');
      }
      navigate(next);
    } catch (err) {
      if (err instanceof ApiError && err.details?.field === 'nickname') {
        setFieldError(err.message);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 className="page-title center">👤 Identificação do jogador</h1>
      <p className="page-sub center">
        Sem senha nesta versão: seu apelido vira sua identidade pública no ranking.
      </p>

      <div className="tabs mb-16" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          className={mode === 'new' ? 'active' : ''}
          onClick={() => setMode('new')}
        >
          Criar cadastro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'rejoin'}
          className={mode === 'rejoin' ? 'active' : ''}
          onClick={() => setMode('rejoin')}
        >
          Já tenho cadastro
        </button>
      </div>

      <form className="card" onSubmit={submit}>
        {error && <div className="form-error">{error.message}</div>}

        {mode === 'new' && (
          <div className="field">
            <label htmlFor="name">Nome ou apelido completo</label>
            <input
              id="name"
              className="input"
              value={name}
              maxLength={80}
              autoComplete="nickname"
              placeholder="Ex.: João Silva"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="nickname">{mode === 'new' ? 'Apelido público (opcional)' : 'Seu apelido'}</label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            maxLength={30}
            placeholder={mode === 'new' ? 'Ex.: joao.silva' : 'Digite o apelido usado no cadastro'}
            onChange={(event) => setNickname(event.target.value)}
            required={mode === 'rejoin'}
          />
          {fieldError && <div className="field-error">{fieldError}</div>}
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Entrando…' : mode === 'new' ? 'CRIAR MEU JOGADOR' : 'RECUPERAR SESSÃO'}
        </button>

        <p className="form-note">
          🔐 Seu identificador é um UUID gerado pelo servidor. Na v1.2 entrará login por e-mail e
          Google — o banco já guarda os campos reservados para isso.
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
