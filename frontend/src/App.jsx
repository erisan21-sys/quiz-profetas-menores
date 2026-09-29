import { useEffect, useState } from 'react';
import { useRoute } from './lib/router.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { Layout } from './components/Layout.jsx';

import HomePage from './pages/HomePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import RankingPage from './pages/RankingPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

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
      {page}
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
