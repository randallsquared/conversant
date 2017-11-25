
/**
 * UBER; http://rawgit.com/uber-hypermedia/specification/master/uber-hypermedia.html
 *
 * My initial strategy here will be to traverse each data element and use or generate
 * an ID to match up data with metadata, using said key in both the head and body.
 */

const key_generation_base = 'conversant_autogen';
const key_index_start_pos = 1;

const find_key = (head, rel = null, prefix = '[', suffix = ']', index = null) => {
  if (rel !== null) {
    if (index === null && !(rel in head)) return rel;
    if (index !== null && !(`${rel}${prefix}${index}${suffix}` in head)) return `${rel}${prefix}${index}${suffix}`;
  } else {
    rel = key_generation_base;
  }
  index = parseInt(index);
  if (isNaN(index)) index = key_index_start_pos;
  while (`${rel}${prefix}${index}${suffix}` in head) index++;
  return `${rel}${prefix}${index}${suffix}`;
};

const build_version = (version_string = null) => {
  const version = {};
  version.action = 'http://uberhypermedia.org';
  version.rel = []; // not sure...
  version.title = 'original format';
  version.extend = { uber: { version: version_string } };
  return version;
};

const get_version = (head) => {
  for (const key in head) {
    if ('extend' in head[key] && 'uber' in head[key].extend && head[key].extend.version) {
      const version = head[key].extend.version;
      delete head[key]; // we brought this in; we'll take it out
      return { head, version };
    }
  }
  return { head, version: null };
};

const json_to_uhf = (doc) => {
  const uhf = { head: {}, body: {} };
  const uber = doc.uber;

  // handle data, from which actual data should go in `body`, ideally
  if ('data' in uber) {
    if (Array.isArray(uber.data)) {
      // handle array
    } else {
      // must be object
    }
  }
  // elements to consider: id, name, rel, label, url, template, action, transclude, model, sending, accepting, value/data

  // handle error, in which everything should go into `head`, since it is meta-only
  if (uber.version) {
    uhf.head[find_key(uhf.head)] = build_version(uber.version);
  }
  return uhf;
};

const to_uhf = (doc) => {
  return json_to_uhf(JSON.parse(doc));
};

const from_uhf = (uhf) => {
  const { head, version } = get_version(uhf.head);
  const uber = version ? { version } : {};

  return { uber };
};

module.exports = { to_uhf, from_uhf };
