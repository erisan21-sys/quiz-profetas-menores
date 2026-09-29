/** Persistência local segura (nunca guarda respostas corretas nem pontuação). */

const PREFIX = 'quiz-profetas:v1:';

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      const value = safeParse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* armazenamento indisponível (modo privado) */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignora */
    }
  },
};

export const sessionStore = {
  read() {
    return storage.get('session', null);
  },
  save(session) {
    storage.set('session', session);
  },
  clear() {
    storage.remove('session');
  },
};

/** Último resultado exibido (permite recarregar a tela de resultado). */
export const lastResultStore = {
  read(attemptId) {
    const saved = storage.get('lastResult', null);
    return saved && saved.id === attemptId ? saved : null;
  },
  save(result) {
    storage.set('lastResult', result);
  },
  clear() {
    storage.remove('lastResult');
  },
};

/** Fila de respostas aguardando sincronização quando a conexão cai. */
export const pendingQueueStore = {
  read() {
    return storage.get('pendingAnswers', []);
  },
  save(queue) {
    storage.set('pendingAnswers', queue);
  },
  clear() {
    storage.remove('pendingAnswers');
  },
};
