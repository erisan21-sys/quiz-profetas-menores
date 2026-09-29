import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { api, OfflineError } from '../api/client.js';
import { sessionStore } from '../lib/storage.js';

/**
 * Estado global da aplicação:
 *  • sessão do jogador (token + perfil básico)
 *  • status de conexão (aviso offline)
 *  • toasts e prompt de instalação do PWA
 */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => sessionStore.read());
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [toasts, setToasts] = useState([]);
  const [installEvent, setInstallEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const toastId = useRef(0);

  /* ------------------------------------------------------------- conexão */
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const swMessage = (event) => {
      if (event.data?.type === 'sw:offline') setOnline(false);
      if (event.data?.type === 'sw:online') setOnline(true);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('message', swMessage);
    navigator.serviceWorker?.addEventListener?.('message', swMessage);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('message', swMessage);
      navigator.serviceWorker?.removeEventListener?.('message', swMessage);
    };
  }, []);

  /* -------------------------------------------------------- PWA install */
  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* ------------------------------------------------------------- toasts */
  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, kind = 'info', timeout = 4200) => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((current) => [...current.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismissToast(id), timeout);
      return id;
    },
    [dismissToast],
  );

  /* ------------------------------------------------------------- sessão */
  const applySession = useCallback((payload) => {
    const next = payload
      ? { token: payload.token, user: payload.user, expires_at: payload.expires_at }
      : null;
    if (next) sessionStore.save(next);
    else sessionStore.clear();
    setSession(next);
    return next;
  }, []);

  const register = useCallback(
    async (payload) => {
      const data = await api.register(payload);
      applySession(data);
      return data;
    },
    [applySession],
  );

  const rejoin = useCallback(
    async (nickname) => {
      const data = await api.rejoin({ nickname });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const logout = useCallback(() => {
    applySession(null);
  }, [applySession]);

  /** Valida o token guardado ao abrir o app. */
  const refreshSession = useCallback(async () => {
    const current = sessionStore.read();
    if (!current?.token) return null;
    try {
      const data = await api.myProfile();
      const next = { ...current, user: data.user };
      sessionStore.save(next);
      setSession(next);
      return next;
    } catch (err) {
      if (err instanceof OfflineError) return current; // offline: mantém sessão local
      applySession(null);
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    if (session?.token) refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const installApp = useCallback(async () => {
    if (!installEvent) return false;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === 'accepted') setInstallEvent(null);
    return choice?.outcome === 'accepted';
  }, [installEvent]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      online,
      toasts,
      notify,
      dismissToast,
      register,
      rejoin,
      logout,
      refreshSession,
      installEvent,
      installApp,
      isStandalone,
    }),
    [
      session, online, toasts, notify, dismissToast, register, rejoin, logout,
      refreshSession, installEvent, installApp, isStandalone,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp precisa estar dentro de <AppProvider>.');
  return context;
}

export default AppContext;
