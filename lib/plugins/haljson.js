/**
 * HAL has _links, _embedded, and everything else.
 *
 * Missing:
 *  - doesn't put together real links from CURIEs, so anything other than HAL output will have incorrect URIs
 *
 *
 */

const _embedded = '_embedded';
const _links = '_links';
const key_regex = /([^\[\]]+)[\[](\d+)[\]]/;
const key_regex_rel_pos = 1;
//const key_regex_index_pos = 2;
const key_index_start_pos = 0;
const extensions = ['templated', 'deprecation', 'name', 'profile', 'hreflang'];
const direct = { title: 'title', type: 'content-type' };


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
  // if there is a rel, we want to use that for sure
  if ('rel' in item) return item.rel;
  // otherwise, let's examine the key
  const multiple = key.match(key_regex);
  return [multiple ? multiple[key_regex_rel_pos] : key];
};

const build_affordance = (link, rel, singular=false) => {
  const affordance = { extend: { hal: { link, singular } } };
  affordance.action = link.href;
  for (const key in direct) {
    if (key in link) {
      affordance[key] = link[key];
    }
  }
  extensions.forEach((key) => {
    if (key in link) {
      affordance.extend[key] = link[key];
    }
  });
  return affordance;
};

const build_link = (aff, self_href) => {
  const link = {};
  link.href = 'action' in aff ? aff.action : self_href;
  for (const key in direct) {
    if (direct[key] in aff) {
      link[key] = aff[direct[key]];
    }
  }
  if ('extend' in aff) {
    extensions.forEach((key) => {
      if (key in aff.extend) {
        link[key] = aff.extend[key];
      }
    });
  }
  return link;
};

const add_links = (links, head) => {
  for (const rel in links) {
    const singular = !Array.isArray(links[rel]);
    const related = singular ? [links[rel]] : links[rel];
    related.forEach((link, i) => {
      const aff = build_affordance(link, rel, singular);
      aff.rel = [rel];
      head[find_key(rel, head, i)] = aff;
    });
  }
  return head;
};

const add_embedded = (embedded, head) => {
  for (const rel in embedded) {
    const related = Array.isArray(embedded[rel]) ? embedded[rel] : [embedded[rel]];
    related.forEach((obj, i) => {
      const mini_hal = json_to_uhf(obj);
      mini_hal.rel = [rel];
      head[find_key(rel, head, i)] = mini_hal;
    });
  }
  return head;
};

const is_embedded = (obj) => {
  return 'head' in obj || 'body' in obj;
};

const is_link = (obj) => {
  const keys = Object.keys(obj);
  const embeddeds = ['head', 'body', 'rel'];
  return keys.some((key) => !embeddeds.includes(key));
};

const is_singular_rel = (obj) => {
  return 'extend' in obj && 'hal' in obj.extend && obj.extend.hal.singular;
};

const find = (head, rel_search) => {
  const found = [];
  for (const key in head) {
    if ('rel' in head[key]) {
      const selfs = head[key]['rel'].map((rel) => rel === rel_search ? head[key] : undefined).filter((item) => !!item);
      found.push(...selfs);
    }
  }
  return found;
};

const find_self_href = (head) => {
  const links = find(head, 'self');
  const self = links.find((link) => 'action' in link && link.action !== '');
  return self ? self.action : '';
};

const to_uhf = (doc) => {
  return json_to_uhf(JSON.parse(doc));
};

const json_to_uhf = (hal) => {
  const uhf = { head: {}, body: {} };
  for (const elem in hal) {
    switch (elem) {
      case _links:
        uhf.head = add_links(hal._links, uhf.head);
        break;
      case _embedded:
        uhf.head = add_embedded(hal._embedded, uhf.head);
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
  if (uhf.head) {
    const self_href = find_self_href(uhf.head);
    for (const elem in uhf.head) {
      const val = uhf.head[elem];
      if (is_embedded(val)) {
        // this must be represented by _embedded
        if (!(_embedded in hal)) hal._embedded = {};
        const mini_hal = from_uhf(val);
        const rels = find_rels(val, elem);
        rels.forEach((rel) => {
          if (hal._embedded[rel]) {
            if (!Array.isArray(hal._embedded[rel])) {
              hal._embedded[rel] = [hal._embedded[rel]];
            }
            hal._embedded[rel].push(mini_hal);
          } else {
            hal._embedded[rel] = mini_hal;
          }
        });
      }
      if(is_link(val)) {
        if (!(_links in hal)) hal._links = {};
        const link = build_link(val, self_href);
        const rels = find_rels(val, elem);
        rels.forEach((rel) => {
          if (Array.isArray(hal._links[rel])) {
            // already have an array; nothing to decide
            hal._links[rel].push(link);
          } else if (rel in hal._links) {
            // previously got 'singular', but now we are forced to upgrade to multiple
            hal._links[rel] = [hal._links[rel], link];
          } else if (is_singular_rel(val)) {
            // if original was singular, changing it might break clients
            hal._links[rel] = link;
          } else {
            // if unsure, assume multiple
            hal._links[rel] = [link];
          }
        });
      }
    }
  }
  return hal;
};

module.exports = { to_uhf, from_uhf };
