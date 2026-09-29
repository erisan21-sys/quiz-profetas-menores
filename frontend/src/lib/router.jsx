import { useCallback, useEffect, useState } from 'react';

/**
 * Roteador mínimo baseado em hash (#/caminho).
 * Funciona em qualquer hospedagem estática (sem rewrites de servidor) e
 * dentro do PWA instalado. Mantém o contrato de navegação do app inteiro.
 */

export function currentPath() {
  const raw = window.location.hash.replace(/^#+/, '');
  // Rotas internas sempre começam com "/". Hashes injetados por ambientes
  // embutidos (iframes de preview, leitores de arquivo etc.) são ignorados e
  // o app abre na tela inicial em vez de cair no 404.
  if (!raw.startsWith('/')) return '/';
  return raw;
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function useRoute() {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  const [pathname, queryString = ''] = path.split('?');
  const segments = pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(queryString);

  return { path, pathname, segments, params, navigate };
}

/** Link que marca a rota ativa. */
export function useIsActive(pathname) {
  return useCallback(
    (to) => {
      const target = to.split('?')[0];
      if (target === '/') return pathname === '/';
      return pathname === target || pathname.startsWith(`${target}/`);
    },
    [pathname],
  );
}

export default useRoute;
