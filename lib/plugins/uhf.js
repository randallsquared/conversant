
/**
 * Essentially a no-op, since UHF is the internal representation.
 *
 */

const to_uhf = (doc) => {
  const uhf = JSON.parse(doc);
  return uhf;
};

const from_uhf = (doc) => {
  return doc;
};

module.exports = { to_uhf, from_uhf };
