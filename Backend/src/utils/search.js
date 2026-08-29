const MAX_SEARCH_TERM_LENGTH = 100;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Convert user input into a literal, bounded search expression. This prevents
// callers from supplying regex operators that could cause excessive work.
const createLiteralSearchRegex = (value, fieldName = 'Search') => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be text`);
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;
  if (normalizedValue.length > MAX_SEARCH_TERM_LENGTH) {
    throw new Error(`${fieldName} must not exceed ${MAX_SEARCH_TERM_LENGTH} characters`);
  }

  return new RegExp(escapeRegExp(normalizedValue), 'i');
};

module.exports = { createLiteralSearchRegex };
