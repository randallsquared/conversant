/**
 * HAL has _links, _embedded, and everything else.
 *
 *
 *
 *
 *
 *
 */

const _embedded = '_embedded';
const _links = '_links';
const key_regex = /([^\[\]]+)[\[](\d+)[\]]/;
const key_regex_rel_pos = 1;
//const key_regex_index_pos = 2;
const key_index_start_pos = 0;


const find_key = (rel, head, index = null) => {
  if (index === null && !(rel in head)) return rel;
  if (index !== null && !(`${rel}[${index}]` in head)) return `${rel}[${index}]`;
  index = parseInt(index);
  if (isNaN(index)) index = key_index_start_pos;
  while (`${rel}[${index}]` in head) index++;
  return `${rel}[${index}]`;
};

// TODO: use UHF generic metadata to store this information,
// rather than using the key of the item in `head`, which is
// only intended for readability.
const find_rels = (item, key) => {
  let rels = [key];
  let multiple = false;
  // if there is a rel, we want to use that for sure
  if ('rel' in item) rels = item.rel;
  // otherwise, let's examine the key
  const multikey = find_rel_from_multiple(key);
  if (multikey !== false) {
    rels = [multikey];
    multiple = true;
  }
  return { rels, multiple };
};

const find_rel_from_multiple = (key) => {
  const multiple = key.match(key_regex);
  return multiple ? multiple[key_regex_rel_pos] : false;
};

const add_embedded = (embedded, head) => {
  for (const rel in embedded) {
    const related = embedded[rel];
    if (related instanceof Array) {
      related.forEach((obj, i) => {
        const mini_hal = json_to_uhf(obj);
        mini_hal.rel = [rel];
        head[find_key(rel, head, i)] = mini_hal;
      });
    } else {
      const mini_hal = json_to_uhf(related);
      mini_hal.rel = [rel];
      head[find_key(rel, head)] = mini_hal;
    }
  }
  return head;
};

const to_uhf = (doc) => {
  return json_to_uhf(JSON.parse(doc));
};

const json_to_uhf = (hal) => {
  const uhf = { head: {}, body: {} };
  for (const elem in hal) {
    switch (elem) {
      case _links:
        //uhf.head = add_links(hal._links, uhf.head);
        break;
      case _embedded:
        uhf.head = add_embedded(hal[_embedded], uhf.head);
        break;
      default:
        uhf.body[elem] = hal[elem];
    }
  }
  return uhf;
};

const from_uhf = (uhf) => {
  const hal = {};
  for (const elem in uhf.body) {
    hal[elem] = uhf.body[elem];
  }
  for (const elem in uhf.head) {
    const val = uhf.head[elem];
    if ('head' in val || 'body' in val) {
      // this must be represented by _embedded
      if (!(_embedded in hal)) hal[_embedded] = {};
      const mini_hal = from_uhf(val);
      const { rels, multiple } = find_rels(val, elem);
      rels.forEach((rel) => {
        const item = hal[_embedded][rel] || (multiple ? [] : mini_hal);
        if (item instanceof Array) {
          item.push(mini_hal);
        }
        hal[_embedded][rel] = item;
      });
    }
  }
  return hal;
};

module.exports = { to_uhf, from_uhf };
