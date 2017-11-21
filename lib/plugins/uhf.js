
/**
 * Essentially a no-op, since UHF is the internal representation.
 *
 */

const to_uhf = (doc) => {
  return JSON.parse(doc);
};

const from_uhf = (doc) => {
  return doc;
};

module.exports = { to_uhf, from_uhf };
