import { ApiError, LETTERS, normalizeDifficulty, sanitizeText } from './rules.js';

const SOURCE_TYPES = ['texto_biblico', 'historico', 'interpretacao'];

/**
 * Valida o payload de criação/edição de questões usado pela área administrativa.
 * Garante objetividade: 4 alternativas distintas, exatamente 1 correta,
 * explicação e dica obrigatórias.
 */
export function validateQuestionPayload(input = {}, { partial = false } = {}) {
  const payload = {};

  const set = (key, value) => {
    payload[key] = value;
  };

  const has = (key) => Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;

  if (!partial) {
    const required = ['question', 'difficulty', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation', 'hint'];
    const missing = required.filter((key) => !has(key));
    if (missing.length) {
      throw new ApiError(400, `Campos obrigatórios ausentes: ${missing.join(', ')}.`);
    }
  }

  if (has('book')) {
    const book = sanitizeText(input.book, 32).toLowerCase().replace(/[^a-záàâãéêíóôõúç0-9_-]/gi, '');
    if (!book) throw new ApiError(400, 'O profeta é obrigatório.');
    set('book', book);
  } else if (!partial) {
    set('book', 'todos');
  }

  if (has('chapter')) {
    const chapter = Number(input.chapter);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 12) {
      throw new ApiError(400, 'O capítulo deve ser um número entre 1 e 12.');
    }
    set('chapter', chapter);
  } else if (!partial) {
    set('chapter', 1);
  }

  if (has('question')) {
    const text = sanitizeText(input.question, 600);
    if (text.length < 10) throw new ApiError(400, 'O enunciado deve ter pelo menos 10 caracteres.');
    set('question', text);
  }

  if (has('difficulty')) {
    const difficulty = normalizeDifficulty(input.difficulty);
    if (!difficulty) throw new ApiError(400, 'Dificuldade inválida. Use facil, medio ou dificil.');
    set('difficulty', difficulty);
  }

  for (const letter of LETTERS) {
    const key = `option_${letter.toLowerCase()}`;
    if (has(key)) {
      const text = sanitizeText(input[key], 300);
      if (!text) throw new ApiError(400, `A alternativa ${letter} não pode ficar vazia.`);
      set(key, text);
    }
  }

  const options = LETTERS.map((l) => payload[`option_${l.toLowerCase()}`] ?? input[`option_${l.toLowerCase()}`]).filter(Boolean);
  const uniqueOptions = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (!partial && uniqueOptions.size !== 4) {
    throw new ApiError(400, 'As quatro alternativas devem ser diferentes entre si.');
  }

  if (has('correct_answer')) {
    const letter = String(input.correct_answer).trim().toUpperCase();
    if (!LETTERS.includes(letter)) {
      throw new ApiError(400, 'Resposta correta inválida. Use A, B, C ou D.');
    }
    set('correct_answer', letter);
  }

  for (const key of ['explanation', 'hint']) {
    if (has(key)) {
      const text = sanitizeText(input[key], 1200);
      if (text.length < 5) throw new ApiError(400, `${key === 'hint' ? 'A dica' : 'A explicação'} deve ter pelo menos 5 caracteres.`);
      set(key, text);
    }
  }

  if (has('source_type')) {
    const sourceType = String(input.source_type).trim().toLowerCase();
    if (!SOURCE_TYPES.includes(sourceType)) {
      throw new ApiError(400, 'Tipo de fonte inválido. Use texto_biblico, historico ou interpretacao.');
    }
    set('source_type', sourceType);
  }

  if (has('order_index')) {
    const order = Number(input.order_index);
    if (!Number.isFinite(order)) throw new ApiError(400, 'order_index deve ser numérico.');
    set('order_index', Math.max(0, Math.floor(order)));
  }

  if (has('active')) set('active', Boolean(input.active));

  return payload;
}

export default validateQuestionPayload;
