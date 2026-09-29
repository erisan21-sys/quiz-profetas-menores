import { Link } from './Link.jsx';
import { useApp } from '../context/AppContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Início' },
  { to: '/quiz', label: 'Jogar' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/historico', label: 'Histórico' },
  { to: '/estatisticas', label: 'Estatísticas' },
  { to: '/perfil', label: 'Perfil' },
];

/** Casca da aplicação: cabeçalho, navegação, banner offline, toasts e rodapé. */
export function Layout({ children, route, isAdmin }) {
  const { user, online, toasts, dismissToast, installEvent, installApp, isStandalone, logout } = useApp();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand">
            <img src="/icons/icon.svg" alt="" width="34" height="34" />
            <span>
              Quiz Bíblico
              <small>12 PROFETAS</small>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Navegação principal">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} active={isActive(route.pathname, item.to)}>
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" active={route.pathname === '/admin'}>
                Admin
              </Link>
            )}
          </nav>

          <div className="header-user">
            {user ? (
              <>
                <span className="avatar" title={user.nickname} aria-hidden="true">
                  {user.nickname.slice(0, 1).toUpperCase()}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={logout} title="Sair">
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className="btn btn-sm btn-primary">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          <span aria-hidden="true">📡</span>
          <span>
            Sem conexão. A interface continua funcionando em modo offline, mas a pontuação
            oficial só é registrada com conexão.
          </span>
        </div>
      )}

      <main className="app-main">{children}</main>

      <footer className="footer">
        <div>
          Quiz Bíblico — Profetas Menores · v1.0 · pontuação oficial calculada pelo servidor
        </div>
        {installEvent && !isStandalone && (
          <button type="button" className="btn btn-sm btn-ghost mt-8" onClick={() => installApp()}>
            📲 Instalar aplicativo
          </button>
        )}
      </footer>

      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast ${toast.kind}`}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  );
}

function isActive(pathname, to) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default Layout;
