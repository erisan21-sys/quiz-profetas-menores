import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook de busca de dados resiliente ao "cold start" do plano gratuito do
 * Render (pode levar 30-60s para acordar) e pensado para fluidez entre telas:
 *
 *  • Mantém o último resultado bem-sucedido (cache em localStorage) e o exibe
 *    IMEDIATAMENTE ao entrar numa tela, mesmo antes da resposta da rede —
 *    a tela nunca fica em branco/skeleton se já existir algo visto antes.
 *  • Atualiza em segundo plano (stale-while-revalidate): o spinner cheio só
 *    aparece quando não há absolutamente nada em cache para mostrar.
 *  • Tenta de novo com espera crescente (até ~1 min) antes de desistir,
 *    porque o servidor gratuito pode estar "acordando".
 *  • Nunca troca dados reais: é só leitura (GET); a pontuação oficial nunca
 *    passa por aqui.
 */

const WAKE_WAITS = [0, 2500, 4000, 6000, 9000, 12000, 16000];

function cacheKey(key) {
  return `quiz-profetas:v1:query-cache:${key}`;
}

function readCache(key) {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  if (!key) return;
  try {
    window.localStorage.setItem(cacheKey(key), JSON.stringify(value));
  } catch {
    /* localStorage indisponível (modo privado etc.): segue sem cache */
  }
}

/**
 * @param {string|null} key chave estável para cache local (null desativa cache)
 * @param {() => Promise<any>} fetcher função assíncrona que busca os dados
 * @param {Array} deps dependências que disparam nova busca (como useEffect)
 */
export function useResilientQuery(key, fetcher, deps = []) {
  const [data, setData] = useState(() => readCache(key));
  const [error, setError] = useState(null);
  const [waking, setWaking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const aliveRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = (requestIdRef.current += 1);
    const hadCached = Boolean(readCache(key));
    setError(null);
    setWaking(false);
    setRefreshing(true);
    if (!hadCached) setData(readCache(key));

    for (let attempt = 0; attempt < WAKE_WAITS.length; attempt += 1) {
      if (WAKE_WAITS[attempt]) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, WAKE_WAITS[attempt]));
        if (requestId !== requestIdRef.current || !aliveRef.current) return undefined;
        setWaking(true);
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await fetcherRef.current();
        if (requestId !== requestIdRef.current || !aliveRef.current) return undefined;
        setData(result);
        setError(null);
        setWaking(false);
        setRefreshing(false);
        writeCache(key, result);
        return result;
      } catch (err) {
        if (requestId !== requestIdRef.current || !aliveRef.current) return undefined;
        if (attempt < WAKE_WAITS.length - 1) continue;
        setError(err);
        setWaking(false);
        setRefreshing(false);
      }
    }
    return undefined;
  }, [key]);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, waking, refreshing, reload: load, hasData: data != null };
}

export default useResilientQuery;
