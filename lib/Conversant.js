
const ingest_prefix = '_ingest_';

const formats = [
//  cj: 'Collection+json',
 { name: 'hal', base: 'JSON', require: './plugins/haljson', to_uhf: 'to_uhf', from_uhf: 'from_uhf', type: 'application/hal+json'},
//  siren: 'Siren',
//  uber: 'Uber',
];

const unimpl = () => {
  throw new Error('not yet implemented');
};

class Conversant {

  constructor(blob, type = 'autodetect') {
    this.raw = blob;
    this.type = this.determine_type(blob, type);
    this.formats().forEach(f => {
      const ingest = this.assign(f.name, require(f.require));
      if (f.type === type) this.uhf = ingest(blob);
    });
  }

  determine_type(blob, type) {
    return null;
  }

  assign(name, worker) {
    const produce = function () {
      return worker.from_uhf(this.uhf);
    };

    this[name] = produce.bind(this);
    return worker.to_uhf;
  }

  formats() {
    return formats;
  }

}

Conversant.formats = () => {
  return formats;
};

module.exports = Conversant;
