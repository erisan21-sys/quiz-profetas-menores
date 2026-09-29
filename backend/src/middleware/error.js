import { ApiError } from '../utils/rules.js';
import config from '../config/index.js';

/** 404 padronizado para rotas inexistentes. */
export function notFound(req, res, next) {
  next(new ApiError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

/** Conversor central de erros -> resposta JSON. Nunca vaza stack em produção. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[erro] ${req.method} ${req.originalUrl} ->`, err.message);
    if (!config.isProduction) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
  }

  res.status(status).json({
    error:
      status >= 500 && config.isProduction
        ? 'Erro interno do servidor.'
        : err.message || 'Erro inesperado.',
    details: err.details,
  });
}

/** Captura erros assíncronos sem precisar de try/catch em cada handler. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
