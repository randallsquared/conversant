
const ingest_prefix = '_ingest_';

const formats = [
//  cj: 'Collection+json',
  { name: 'hal', base: 'JSON', require: './plugins/haljson', to_uhf: 'to_uhf', from_uhf: 'from_uhf', type: 'application/hal+json', example: 'hal.json'},
//  siren: 'Siren',
  { name: 'uber', base: 'JSON', require: './plugins/uber', to_uhf: 'to_uhf', from_uhf: 'from_uhf', type: 'application/vnd.uber+json', example: 'uber.json' },
  { name: 'uhf', base: 'JSON', require: './plugins/uhf', to_uhf: 'to_uhf', from_uhf: 'from_uhf', type: 'application/vnd.uhf+json', example: 'uhf.json' },
];

const unimpl = () => {
  throw new Error('not yet implemented');
};

class Conversant {

  constructor(blob, type = 'autodetect') {
    this.raw = blob;
    this.type = this.determine_type(blob, type);
    this.formats().forEach(f => {
      const ingest = this.assign(f.name, f.to_uhf, f.from_uhf, require(f.require));
      if (f.type === type) this.internal = ingest(blob);
    });
  }

  determine_type(blob, type) {
    // TODO: actually try to determine type.  :/
    return type;
  }

  assign(name, to_uhf_func, from_uhf_func, worker) {
    const produce = function () {
      return worker[from_uhf_func](this.internal);
    };

    this[name] = produce.bind(this);
    return worker[to_uhf_func];
  }

  formats() {
    return formats;
  }

}

Conversant.formats = () => {
  return formats;
};

module.exports = Conversant;
