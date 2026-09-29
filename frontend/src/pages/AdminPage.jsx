import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { DifficultyBadge, ErrorState, Loading, Modal, SourceBadge, StatsGrid } from '../components/ui.jsx';
import { formatDate, formatNumber, formatPercent } from '../lib/format.js';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'questions', label: 'Perguntas' },
  { id: 'users', label: 'Usuários' },
  { id: 'attempts', label: 'Partidas' },
  { id: 'ranking', label: 'Ranking' },
];

const EMPTY_QUESTION = {
  chapter: 1,
  question: '',
  difficulty: 'facil',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A',
  explanation: '',
  hint: '',
  source_type: 'texto_biblico',
};

/** Área administrativa (/admin) — protegida por token no servidor. */
export function AdminPage() {
  const { notify } = useApp();
  const [token, setToken] = useState(() => window.sessionStorage.getItem('qzd:admin') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [tab, setTab] = useState('overview');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (token) window.sessionStorage.setItem('qzd:admin', token);
    else window.sessionStorage.removeItem('qzd:admin');
  }, [token]);

  function submitToken(event) {
    event.preventDefault();
    setToken(tokenInput.trim());
    setAuthError(null);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto' }} className="rise">
        <h1 className="page-title center"> Área administrativa</h1>
        <p className="page-sub center">
          Acesso restrito. Informe o token de administrador configurado no backend
          (<code>ADMIN_TOKEN</code>).
        </p>
        <form className="card" onSubmit={submitToken}>
          {authError && <div className="form-error">{authError}</div>}
          <div className="field">
            <label htmlFor="admin-token">Token do administrador</label>
            <input
              id="admin-token"
              type="password"
              className="input"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="cole o ADMIN_TOKEN"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">Entrar no painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="rise">
      <div className="flex between items-center wrap gap-8">
        <h1 className="page-title">🛠️ Administração</h1>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setToken('')}>
          Sair do painel
        </button>
      </div>

      <div className="tabs mb-16">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview token={token} onAuthError={setAuthError} />}
      {tab === 'questions' && <Questions token={token} notify={notify} onAuthError={setAuthError} />}
      {tab === 'users' && <Users token={token} notify={notify} onAuthError={setAuthError} />}
      {tab === 'attempts' && <Attempts token={token} onAuthError={setAuthError} />}
      {tab === 'ranking' && <AdminRanking token={token} onAuthError={setAuthError} />}
    </div>
  );
}

function useAdminData(loader, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    setData(null);
    loader().then(setData).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return [data, error, load];
}

function Unauthorized({ error, onRetry }) {
  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="card center">
        <p>🔒 Credencial de administrador inválida ou expirada.</p>
        {onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>Tentar novamente</button>}
      </div>
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

/* ------------------------------------------------------------- visão geral */
function Overview({ token, onAuthError }) {
  const [data, error, load] = useAdminData(() => api.adminOverview(token), [token]);
  if (error) return <Unauthorized error={error} onRetry={load} />;
  if (!data) return <Loading />;

  return (
    <>
      <StatsGrid
        items={[
          { icon: '👥', label: 'Jogadores', value: formatNumber(data.stats.total_players) },
          { icon: '🎮', label: 'Partidas', value: formatNumber(data.stats.total_attempts) },
          { icon: '💬', label: 'Respostas', value: formatNumber(data.stats.total_answers) },
          { icon: '🏆', label: 'Maior pontuação', value: formatNumber(data.stats.best_score) },
        ]}
      />
      <div className="stats-grid mt-16">
        <div className="stat-card"><div className="stat-value num">{data.distribution.facil}</div><div className="stat-label">fáceis ativas</div></div>
        <div className="stat-card"><div className="stat-value num">{data.distribution.medio}</div><div className="stat-label">médias ativas</div></div>
        <div className="stat-card"><div className="stat-value num">{data.distribution.dificil}</div><div className="stat-label">difíceis ativas</div></div>
        <div className="stat-card"><div className="stat-value num">{data.distribution.inativas}</div><div className="stat-label">inativas</div></div>
      </div>

      <div className="grid-2 mt-16">
        <div className="card">
          <h3 className="card-title">👥 Últimos cadastros</h3>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>APELIDO</th><th>PAPEL</th><th>CRIADO EM</th></tr></thead>
              <tbody>
                {data.latest_users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.nickname}</td>
                    <td><span className={`badge ${user.role === 'admin' ? 'badge-gold' : 'badge-muted'}`}>{user.role}</span></td>
                    <td>{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">🎮 Últimas partidas</h3>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>JOGADOR</th><th className="num">PONTOS</th><th className="num">%</th><th>STATUS</th></tr></thead>
              <tbody>
                {data.latest_attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.nickname}</td>
                    <td className="num">{attempt.score_label}</td>
                    <td className="num">{formatPercent(attempt.percentage)}</td>
                    <td><span className="badge badge-muted">{attempt.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- perguntas */
function Questions({ token, notify, onAuthError }) {
  const [data, error, load] = useAdminData(() => api.adminQuestions(token), [token]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  if (error) return <Unauthorized error={error} onRetry={load} />;
  if (!data) return <Loading />;

  async function remove(question) {
    if (!window.confirm(`Excluir a pergunta "${question.question.slice(0, 60)}…"?`)) return;
    try {
      const result = await api.adminDeleteQuestion(question.id, token);
      notify(result.message, 'success');
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <>
      <div className="flex between items-center wrap gap-8 mb-16">
        <p className="muted mb-0">{data.total} perguntas cadastradas (6 fáceis · 8 médias · 6 difíceis é o padrão oficial).</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          ➕ Nova pergunta
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>#</th><th>ENUNCIADO</th><th>PROFETA</th><th>CAP.</th><th>DIFICULDADE</th><th>GABARITO</th><th>FONTE</th><th>ATIVA</th><th> </th></tr>
          </thead>
          <tbody>
            {data.items.map((question, index) => (
              <tr key={question.id}>
                <td className="num">{index + 1}</td>
                <td style={{ maxWidth: 340 }}>{question.question}</td>
                <td>{question.book_name || question.book || '—'}</td>
                <td className="num">{question.chapter}</td>
                <td><DifficultyBadge difficulty={question.difficulty} /></td>
                <td><strong>{question.correct_answer}</strong></td>
                <td><SourceBadge source={question.source_type} /></td>
                <td>{question.active === false ? '❌' : '✅'}</td>
                <td>
                  <div className="flex gap-8">
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(question)}>Editar</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(question)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <QuestionForm
          token={token}
          initial={editing || EMPTY_QUESTION}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            notify('Pergunta salva. ✅', 'success');
            load();
          }}
          notify={notify}
        />
      )}
    </>
  );
}

function QuestionForm({ token, initial, onClose, onSaved, notify }) {
  const [form, setForm] = useState({ ...EMPTY_QUESTION, ...initial });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, chapter: Number(form.chapter) };
      if (initial.id) await api.adminUpdateQuestion(initial.id, payload, token);
      else await api.adminCreateQuestion(payload, token);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial.id ? 'Editar pergunta' : 'Nova pergunta'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <div className="form-error">{error.message}</div>}
        <div className="field">
          <label htmlFor="q-text">Enunciado</label>
          <textarea id="q-text" className="input" value={form.question} onChange={set('question')} required />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="q-book">Profeta</label>
            <select id="q-book" className="input" value={form.book} onChange={set('book')}>
              {[['oseias','Oséias'],['joel','Joel'],['amos','Amós'],['obadias','Obadias'],['jonas','Jonas'],['miqueias','Miquéias'],['naum','Naum'],['habacuque','Habacuque'],['sofonias','Sofonias'],['ageu','Ageu'],['zacarias','Zacarias'],['malaquias','Malaquias']].map(([id,name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <label htmlFor="q-chapter">Capítulo</label>
            <input id="q-chapter" type="number" min="1" max="66" className="input" value={form.chapter} onChange={set('chapter')} required />
          </div>
          <div className="field">
            <label htmlFor="q-diff">Dificuldade</label>
            <select id="q-diff" className="input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="facil">Fácil (100 pts)</option>
              <option value="medio">Médio (200 pts)</option>
              <option value="dificil">Difícil (300 pts)</option>
            </select>
          </div>
        </div>
        {['a', 'b', 'c', 'd'].map((letter) => (
          <div className="field" key={letter}>
            <label htmlFor={`q-${letter}`}>Alternativa {letter.toUpperCase()}</label>
            <input id={`q-${letter}`} className="input" value={form[`option_${letter}`]} onChange={set(`option_${letter}`)} required />
          </div>
        ))}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="q-correct">Resposta correta</label>
            <select id="q-correct" className="input" value={form.correct_answer} onChange={set('correct_answer')}>
              <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="q-source">Tipo de fonte</label>
            <select id="q-source" className="input" value={form.source_type} onChange={set('source_type')}>
              <option value="texto_biblico">Texto bíblico</option>
              <option value="historico">Consenso histórico</option>
              <option value="interpretacao">Interpretação teológica</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="q-expl">Explicação</label>
          <textarea id="q-expl" className="input" value={form.explanation} onChange={set('explanation')} required />
        </div>
        <div className="field">
          <label htmlFor="q-hint">Dica</label>
          <input id="q-hint" className="input" value={form.hint} onChange={set('hint')} required />
        </div>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- usuários */
function Users({ token, notify }) {
  const [data, error, load] = useAdminData(() => api.adminUsers({ limit: 100 }, token), [token]);
  if (error) return <Unauthorized error={error} onRetry={load} />;
  if (!data) return <Loading />;

  async function setRole(user, role) {
    try {
      await api.adminSetRole(user.id, role, token);
      notify(`${user.nickname} agora é ${role}.`, 'success');
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function remove(user, mode) {
    if (!window.confirm(`${mode === 'delete' ? 'APAGAR TUDO de' : 'Anonimizar'} ${user.nickname}?`)) return;
    try {
      await api.adminRemoveUser(user.id, mode, token);
      notify('Operação concluída.', 'success');
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr><th>APELIDO</th><th>NOME</th><th>PAPEL</th><th className="num">PARTIDAS</th><th className="num">MELHOR</th><th>ÚLTIMA VEZ</th><th> </th></tr>
        </thead>
        <tbody>
          {data.items.map((user) => (
            <tr key={user.id}>
              <td><strong>{user.nickname}</strong></td>
              <td>{user.name}</td>
              <td><span className={`badge ${user.role === 'admin' ? 'badge-gold' : 'badge-muted'}`}>{user.role}</span></td>
              <td className="num">{user.attempts}</td>
              <td className="num">{user.best_score_label}</td>
              <td>{formatDate(user.last_seen_at)}</td>
              <td>
                <div className="flex gap-8 wrap">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setRole(user, user.role === 'admin' ? 'player' : 'admin')}
                  >
                    {user.role === 'admin' ? 'Rebaixar' : 'Promover'}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => remove(user, 'anonymize')}>Anonimizar</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(user, 'delete')}>Apagar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- partidas */
function Attempts({ token }) {
  const [status, setStatus] = useState('');
  const [data, error, load] = useAdminData(
    () => api.adminAttempts({ limit: 100, status }, token),
    [token, status],
  );
  if (error) return <Unauthorized error={error} onRetry={load} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="tabs mb-16">
        {[{ id: '', label: 'TODAS' }, { id: 'FINISHED', label: 'FINALIZADAS' }, { id: 'STARTED', label: 'EM ANDAMENTO' }, { id: 'ABANDONED', label: 'ABANDONADAS' }].map((item) => (
          <button key={item.id || 'all'} type="button" className={status === item.id ? 'active' : ''} onClick={() => setStatus(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>DATA</th><th>JOGADOR</th><th>STATUS</th><th className="num">PONTOS</th><th className="num">ACERTOS</th><th className="num">%</th><th className="num">DURAÇÃO</th></tr>
          </thead>
          <tbody>
            {data.items.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.date_label}</td>
                <td>{attempt.nickname}</td>
                <td><span className="badge badge-muted">{attempt.status}</span></td>
                <td className="num">{attempt.score_label}</td>
                <td className="num">{attempt.correct_answers}/{attempt.total_questions}</td>
                <td className="num">{formatPercent(attempt.percentage)}</td>
                <td className="num">{attempt.duration_label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ ranking */
function AdminRanking({ token }) {
  const [period, setPeriod] = useState('all');
  const [data, error, load] = useAdminData(
    () => api.adminRanking({ period, difficulty: 'all' }, token),
    [token, period],
  );
  if (error) return <Unauthorized error={error} onRetry={load} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="tabs mb-16">
        {[{ id: 'today', label: 'HOJE' }, { id: 'week', label: 'SEMANA' }, { id: 'month', label: 'MÊS' }, { id: 'all', label: 'GERAL' }].map((item) => (
          <button key={item.id} type="button" className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>POS.</th><th>JOGADOR</th><th className="num">PONTOS</th><th className="num">%</th><th className="num">PARTIDAS</th></tr></thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.user_id}>
                <td className="rank-pos num">{row.rank}º</td>
                <td>{row.nickname}</td>
                <td className="num">{formatNumber(row.best_score)}</td>
                <td className="num">{formatPercent(row.best_percentage)}</td>
                <td className="num">{row.attempts_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default AdminPage;
