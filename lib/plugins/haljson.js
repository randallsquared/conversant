/**
 * HAL has _links, _embedded, and everything else.
 *
 * Issues:
 * Currently this ignores URI templates, except for CURIEs.
 * Profiles are saved, but otherwise ignored.  A profile
 *   key in a link should be represented as
 *   `"head": { rel: ["profile"], action: <original value>}`
 * The goal of this plugin is to support fully identical
 *   round-trip from HAL -> UHF -> HAL, but currently this
 *   is not realized.
 * There are undoubtedly a number of corner cases and bugs
 *   to be found.
 */

const _embedded = '_embedded';
const _links = '_links';
const key_regex = /([^\[\]]+)[\[](\d+)[\]]/;
const key_regex_rel_pos = 1;
//const key_regex_index_pos = 2;
const key_index_start_pos = 1;
const extensions = ['deprecation', 'name', 'profile', 'hreflang'];
const direct = { title: 'title', type: 'content-type', templated: 'templated' };
const REL_CURIE = 'http://www.w3.org/TR/curie';


const find_key = (rel, head, prefix='[', suffix=']', index = null) => {
  if (index === null && !(rel in head)) return rel;
  if (index !== null && !(`${rel}${prefix}${index}${suffix}` in head)) return `${rel}${prefix}${index}${suffix}`;
  index = parseInt(index);
  if (isNaN(index)) index = key_index_start_pos;
  while (`${rel}${prefix}${index}${suffix}` in head) index++;
  return `${rel}${prefix}${index}${suffix}`;
};

const find_rels = (item, key) => {
  const unsafe = 'extend' in item && 'hal' in item.extend && !item.extend.hal.safe_curie;

  // if there is a rel, we want to use that for sure
  let rels = item.rels || [];
  if (!rels.length) {
    const multiple = key.match(key_regex);
    if (multiple) {
      rels.push(multiple[key_regex_rel_pos]);
    } else {
      rels.push(key);
    }
  }
  if (unsafe) {
    rels = rels.map((rel) => is_safe_curie(rel) ? rel.slice(1, -1) : rel);
  }
  return rels;
};

const build_affordance = (link, relation, singular = false, safe_curie = false) => {

  const rel = [relation];
  const affordance = { extend: { hal: { singular, safe_curie } }, rel };
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

/**
 * Parse the HAL curies we're given
 *
 * HAL curies are only kinda sorta CURIEs.  They use URL Templates
 * instead of CURIE prefixes, with a single token of {rel}.  If we
 * find this key at the end of the CURIE href, we can just omit it
 * to produce a valid CURIE prefix.
 *
 * Another issue is that the `name` field of a `curies` list is
 * not actually guaranteed to be unique (though it really ought
 * to be, yeah?).   We can't actually correct this, since we don't
 * know which of the references is the correct template to use for
 * these.  Instead, we'll eliminate the discrepancy for UHF, but
 * preserve it for HAL.
 *
 * @param {Array} curies the list of curies we got from HAL
 * @param {Object} head the head object we are building
 * @returns {Object} head
 */
const ingest_curies = (curies, head) => {
  let singular = false;
  if (!Array.isArray(curies)) {
    curies = [curies];
    singular = true;
  }
  const fixes = {};
  const token = '{rel}';
  const start = 0;
  const fail = -1;
  curies.forEach((curie) => {
    let resolve = false;
    let name = curie.name || '';
    let rename = name;
    let action = curie.href || '';
    const first = action.indexOf(token);
    // exactly one and it's the last thing
    if (first !== fail) {
      if (first === (action.length - token.length)) {
        action = action.slice(start, -token.length);
      } else {
        resolve = action;
      }
    }
    if (resolve) {
      fixes[name] = { resolve };
    } else {
      rename = find_key(name, head, '_hal_', '');
      if (rename !== name) {
        fixes[name] = { rename };
        name = rename;
      }
    }
    curie.href = action;
    curie.name = name;
    const aff = build_affordance(curie, REL_CURIE, singular);
    head[name] = aff;
  });
  return { head, fixes };
};

const ingest_links = (links, head, fixes) => {
  for (const rel in links) {
    const singular = !Array.isArray(links[rel]);
    const related = singular ? [links[rel]] : links[rel];
    const safe_curie = is_safe_curie(rel);
    const fixed = fix_curie(rel, fixes);
    related.forEach((link) => {
      const aff = build_affordance(link, fixed, singular, safe_curie);
      head[find_key(rel, head)] = aff;
    });
  }
  return head;
};

const ingest_embedded = (embedded, head, fixes) => {
  for (const rel in embedded) {
    const singular = !Array.isArray(embedded[rel]);
    const related = singular ? [embedded[rel]] : embedded[rel];
    const safe_curie = is_safe_curie(rel);
    const fixed = fix_curie(rel, fixes);
    related.forEach((embed) => {
      const mini = json_to_uhf(embed);
      const hal = { singular, safe_curie };
      if ('extend' in mini) {
        mini.extend.hal = hal;
      } else {
        mini.extend = { hal };
      }
      mini.rel = [fixed];
      head[find_key(rel, head)] = mini;
    });
  }
  return head;
};

const fix_curie = (curie, fixes) => {
  let [name, reference] = curie.split(':');
  if (reference === undefined) {
    reference = name;
    name = '';
  }
  if (reference.startsWith('//')) {
    // not a curie, but an IRI-reference
    return curie;
  }

  if (is_safe_curie(curie)) {
    curie = curie.slice(1, -1);
  }

  if (name in fixes) {
    if ('rename' in fixes[name]) {
      return `[${fixes[name].rename}:${reference}]`;
    } else if ('resolve' in fixes[name]) {
      return fixes[name].resolve.replace(/{ref}/g, reference);
    }
  }
  return `[${curie}]`;
};

const is_safe_curie = (curie) => {
  return curie.startsWith('[') && curie.endsWith(']');
}

const is_embedded = (obj) => {
  return 'head' in obj || 'body' in obj;
};

const is_link = (obj) => {
  const keys = Object.keys(obj);
  const embeddeds = ['head', 'body', 'rel', 'extend'];
  return keys.some((key) => !embeddeds.includes(key));
};

const is_curie = (obj) => {
  return 'rel' in obj && obj.rel.includes(REL_CURIE);
}

const is_singular_rel = (obj) => {
  return 'extend' in obj && 'hal' in obj.extend && obj.extend.hal.singular;
};

const rel_find = (head, rel_search=[]) => {
  const found = {};
  for (const key in head) {
    if ('rel' in head[key]) {
      head[key]['rel'].forEach((rel) => {
        if (rel_search.includes(rel)) found[key] = head[key];
      });
    }
  }
  return found;
};

const find_self_href = (head) => {
  const links = Object.values(rel_find(head, ['self']));
  const self = links.find((link) => 'action' in link && link.action !== '');
  return self ? self.action : '';
};

const to_uhf = (doc) => {
  return json_to_uhf(JSON.parse(doc));
};

const json_to_uhf = (hal) => {
  const uhf = { head: {}, body: {} };
  const handled = { _links, _embedded };
  let fixes = {};

  if (_links in hal) {
    if (hal._links.curies) {
      const curried = ingest_curies(hal._links.curies, uhf.head);
      uhf.head = curried.head;
      fixes = curried.fixes;
      delete hal._links.curies;
    }
    uhf.head = ingest_links(hal._links, uhf.head, fixes);
  }

  if (_embedded in hal) {
    uhf.head = ingest_embedded(hal._embedded, uhf.head, fixes);
  }

  for (const elem in hal) {
    if (handled[elem]) continue;
    uhf.body[elem] = hal[elem];
  }
  return uhf;
};

const attach_hal_item = (item, rel, container, force_singular = false) => {
  if (container === undefined) container = {};
  if (Array.isArray(container[rel])) {
    // already have an array; nothing to decide
    container[rel].push(item);
  } else if (rel in container) {
    // previously got 'singular', but now we are forced to upgrade to multiple
    container[rel] = [container[rel], item];
  } else if (force_singular) {
    // if original was singular, changing it might break clients
    container[rel] = item;
  } else {
    // still unsure, assume multiple
    container[rel] = [item];
  }
  return container;
};

const from_uhf = (uhf) => {
  const hal = {};

  if (typeof uhf.body === 'object' && !(uhf.body instanceof String || uhf.body instanceof Number)) {
    for (const elem in uhf.body) {
      hal[elem] = uhf.body[elem];
    }
  } else {
    hal[''] = uhf.body;
  }
  if (uhf.head) {
    const self_href = find_self_href(uhf.head);
    for (const elem in uhf.head) {
      const val = uhf.head[elem];

      if (is_curie(val)) {
        const link = build_link(val, self_href);
        if (!link.href.includes('{rel}')) link.href = `${link.href}{rel}`;
        const single = is_singular_rel(val);
        hal._links = attach_hal_item(link, 'curies', hal._links, single);
        continue; // avoid adding extra junk to the HAL document
      }

      if (is_embedded(val)) {
        // this must be represented by _embedded, even if other parts make it a _link as well
        if (!(_embedded in hal)) hal._embedded = {};
        const mini_hal = from_uhf(val);
        const rels = find_rels(val, elem);
        const single = is_singular_rel(val);
        rels.forEach((rel) => {
          hal._embedded = attach_hal_item(mini_hal, rel, hal._embedded, single);
        });
      }

      if(is_link(val)) {
        const link = build_link(val, self_href);
        const rels = find_rels(val, elem);
        const single = is_singular_rel(val);
        rels.forEach((rel) => {
          hal._links = attach_hal_item(link, rel, hal._links, single);
        });
      }
    }
  }
  return hal;
};

module.exports = { to_uhf, from_uhf };
