import { navigate } from '../lib/router.jsx';

/** Âncora que navega pelo roteador de hash sem recarregar a página. */
export function Link({ to, children, className = '', active = false, ...rest }) {
  return (
    <a
      href={`#${to}`}
      className={`${className} ${active ? 'active' : ''}`.trim()}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export default Link;
