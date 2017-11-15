const fs = require('fs');
const test = require('ava').test;

const Conversant = require('../index');
const formats = Conversant.formats();


for (const {name, type} of formats) {
  const resultkey = `Conversant_${name}`;
  const fixture = fs.readFileSync(`test/fixtures/${name}.txt`, { encoding: 'UTF-8'});
  test.beforeEach(`consume ${type} without error`, async t => {
    t.context[resultkey] = new Conversant(fixture, type);
  });
  for (const out_type of formats) {
    test(`produce ${out_type.type} without error`, async t => {
      t.context[resultkey][out_type.name]();
      t.pass();
    });
  }
  test(`produce ${type} and match it to input`, async t => {
    // is this actually even feasible without cheating and keeping the whole input?  Not sure.
    t.deepEqual(JSON.parse(fixture), t.context[resultkey][name]());
  });
}
