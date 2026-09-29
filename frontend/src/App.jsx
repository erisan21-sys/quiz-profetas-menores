import { lazy, Suspense, useEffect, useState } from 'react';
import { useRoute } from './lib/router.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { Layout } from './components/Layout.jsx';
import { PageSkeleton } from './components/ui.jsx';

// Carregamento sob demanda: cada tela só baixa seu próprio código quando o
// jogador navega até ela pela primeira vez. Isso deixa o carregamento
// inicial do app mais leve e rápido (menos JS para baixar/interpretar antes
// da primeira tela aparecer), sem mudar nada do comportamento visível.
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const QuizPage = lazy(() => import('./pages/QuizPage.jsx'));
const ResultPage = lazy(() => import('./pages/ResultPage.jsx'));
const RankingPage = lazy(() => import('./pages/RankingPage.jsx'));
const HistoryPage = lazy(() => import('./pages/HistoryPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

/** Roteamento da aplicação (hash router, compatível com PWA e host estático). */
export function App() {
  const route = useRoute();
  const [hasAdminSession, setHasAdminSession] = useState(
    () => Boolean(window.sessionStorage.getItem('qzd:admin')),
  );

  useEffect(() => {
    const sync = () => setHasAdminSession(Boolean(window.sessionStorage.getItem('qzd:admin')));
    window.addEventListener('hashchange', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const { pathname, segments, params } = route;

  let page;
  switch (segments[0] || '') {
    case '':
      page = <HomePage />;
      break;
    case 'entrar':
      page = <RegisterPage params={params} />;
      break;
    case 'quiz':
      page = <QuizPage params={params} />;
      break;
    case 'resultado':
      page = <ResultPage segments={segments} />;
      break;
    case 'ranking':
      page = <RankingPage params={params} />;
      break;
    case 'historico':
      page = <HistoryPage />;
      break;
    case 'perfil':
      page = <ProfilePage segments={segments} />;
      break;
    case 'estatisticas':
      page = <StatsPage />;
      break;
    case 'admin':
      page = <AdminPage />;
      break;
    default:
      page = (
        <div className="card center">
          <h1 className="page-title">404</h1>
          <p className="muted">Esta página não existe no Quiz dos Profetas Menores.</p>
          <a className="btn btn-primary" href="#/">Voltar ao início</a>
        </div>
      );
  }

  return (
    <Layout route={route} isAdmin={hasAdminSession || pathname === '/admin'}>
      <Suspense fallback={<PageSkeleton />}>
        <div key={pathname} className="page-transition">
          {page}
        </div>
      </Suspense>
    </Layout>
  );
}

export function AppWithProviders() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

export default AppWithProviders;
