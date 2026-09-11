'use strict';
/**
 * Sheet 11's fit definitions (PR 6 Build B1) — the pure halves of app/devideas_fit.js.
 *
 * The browser halves are driven by scripts/verify_devideas_fit.js, which breaks a real rendered
 * sheet 11 and requires each check to fail. What is covered HERE is every judge on a synthetic
 * probe: silent on a good page, red on each defect it exists to catch.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const DF = require(path.join(path.resolve(__dirname, '..'), 'app/devideas_fit.js'));

const EXPECTED = {
  titles: { growth: 'Growth Strategies', inquiries: 'Inquiries', experiments: 'Field Experiments' },
  rails: { growth: 'G rail', inquiries: 'I rail', experiments: 'E rail' },
  lead: 'Lead.', coda: 'Coda.',
};
const item = (lines, over = {}) => ({ lines, bold: false, lead: null, rest: null, right: 700, ...over });
const exp = (lines) => item(lines, { bold: true, lead: 'Label:', rest: 'Body.' });
/** Type 9 as measured: 7/4/3 items, 7/7/9 lines, one-line header — natural 962.13. */
function probe(over = {}) {
  const card = (key, items) => ({ key, rails: 1, bodies: 1, railLeft: 53, railWidth: 210, contentRight: 743,
    title: EXPECTED.titles[key], desc: EXPECTED.rails[key], items, lines: items.reduce((s, i) => s + i.lines, 0) });
  const cards = [
    card('growth', [1, 1, 1, 1, 1, 1, 1].map((l) => item(l))),
    card('inquiries', [2, 1, 2, 2].map((l) => item(l))),
    card('experiments', [2, 3, 4].map(exp)),
  ];
  for (const c of cards) { c.height = DF.modelHeight([{ lines: c.lines, items: c.items.length }]) - DF.MODEL.fixed; c.railHeight = c.height; }
  const p = { natural: 962.13, headerLines: 1, h1: 'Development Ideas for Peacemakers', lead: EXPECTED.lead, coda: EXPECTED.coda, cards };
  return { ...p, ...over };
}
const all = (p, extra = {}) => [
  ...DF.judgeD1({ tag: 't', probe: p, ...extra }), ...DF.judgeD2({ tag: 't', probe: p }),
  ...DF.judgeD3({ tag: 't', probe: p }), ...DF.judgeD4({ tag: 't', probe: p, expected: EXPECTED, type: 9 }),
];

test('the model reproduces Type 9 as measured, 962.13px', () => {
  assert.strictEqual(DF.modelHeight(probe().cards), 962.13);
});

test('the model floors a short card at its rail, and adds the header wrap', () => {
  // One 1-line item: 32 + 18.75 = 50.75 < 108.02, so the card costs the floor.
  assert.strictEqual(DF.modelHeight([{ lines: 1, items: 1 }]), +(DF.MODEL.fixed + DF.MODEL.cardFloor).toFixed(2));
  assert.strictEqual(DF.modelHeight([{ lines: 1, items: 1 }], { headerLines: 2 }),
    +(DF.MODEL.fixed + DF.MODEL.cardFloor + DF.MODEL.headerWrap).toFixed(2));
});

test('spills() is strict at the sheet: 1056 fits, 1056.01 does not', () => {
  assert.strictEqual(DF.spills(1056), false);
  assert.strictEqual(DF.spills(1056.01), true);
});

test('a good sheet 11 is silent on all four checks', () => {
  assert.deepStrictEqual(all(probe()), []);
});

test('D1 catches a spill, model drift, and a long-name pass whose header did not wrap', () => {
  assert.match(DF.judgeD1({ tag: 't', probe: probe({ natural: 1061.13 }) }).join(), /spills/);
  assert.match(DF.judgeD1({ tag: 't', probe: probe({ natural: 966.13 }) }).join(), /model no longer describes/);
  assert.match(DF.judgeD1({ tag: 't', probe: probe(), longName: true }).join(), /not exercised/);
  assert.deepStrictEqual(DF.judgeD1({ tag: 't', probe: probe({ natural: 973.13, headerLines: 2 }), longName: true }), []);
  assert.match(DF.judgeD1({ tag: 't', probe: null }).join(), /not found/);
  // The NaN the first version produced must now fail loudly, not compare false and pass.
  const broken = probe(); broken.cards[0].lines = undefined;
  assert.match(DF.judgeD1({ tag: 't', probe: broken }).join(), /could not be computed/);
});

test('D2 catches order, a missing rail, an unstretched rail, an empty card, and sideways overflow', () => {
  const p = () => probe();
  const swap = p(); [swap.cards[0], swap.cards[1]] = [swap.cards[1], swap.cards[0]];
  assert.match(DF.judgeD2({ tag: 't', probe: swap }).join(), /want \[growth,inquiries,experiments\]/);
  const noRail = p(); noRail.cards[1].rails = 0;
  assert.match(DF.judgeD2({ tag: 't', probe: noRail }).join(), /0 rail/);
  const short = p(); short.cards[2].railHeight = 108.02;
  assert.match(DF.judgeD2({ tag: 't', probe: short }).join(), /full height/);
  const empty = p(); empty.cards[0].items = [];
  assert.match(DF.judgeD2({ tag: 't', probe: empty }).join(), /no items/);
  const wide = p(); wide.cards[0].items[3].right = 818.6;
  assert.match(DF.judgeD2({ tag: 't', probe: wide }).join(), /75\.6px past its column/);
  const narrow = p(); narrow.cards[1].railWidth = 200;
  assert.match(DF.judgeD2({ tag: 't', probe: narrow }).join(), /rail widths differ/);
});

test('D3 catches a missing bold label, a label without its colon, a label with no body, and bold elsewhere', () => {
  const p = () => probe();
  const noLead = p(); noLead.cards[2].items[0] = item(2);
  assert.match(DF.judgeD3({ tag: 't', probe: noLead }).join(), /does not open with a bold label/);
  const noColon = p(); noColon.cards[2].items[1].lead = 'Label';
  assert.match(DF.judgeD3({ tag: 't', probe: noColon }).join(), /does not end in a colon/);
  const noBody = p(); noBody.cards[2].items[2].rest = '';
  assert.match(DF.judgeD3({ tag: 't', probe: noBody }).join(), /no body/);
  const stray = p(); stray.cards[0].items[0].bold = true;
  assert.match(DF.judgeD3({ tag: 't', probe: stray }).join(), /only Field Experiments/);
});

test('D4 catches a wrong H1, and any shared string that is not the library\'s', () => {
  assert.match(DF.judgeD4({ tag: 't', probe: probe({ h1: 'Development Ideas for Challengers' }), expected: EXPECTED, type: 8 }).join(),
    /want "Development Ideas for Protectors"/);
  const rail = probe(); rail.cards[1].desc = 'Type-specific rail';
  assert.match(DF.judgeD4({ tag: 't', probe: rail, expected: EXPECTED, type: 9 }).join(), /"inquiries" rail description/);
  assert.match(DF.judgeD4({ tag: 't', probe: probe({ coda: 'Other.' }), expected: EXPECTED, type: 9 }).join(), /closing note/);
});

test('judgeAcross is silent on one form and catches two', () => {
  const a = { shared: DF.sharedOf(probe()) };
  const b2 = probe(); b2.cards[0].desc = 'drifted';
  assert.deepStrictEqual(DF.judgeAcross({ rows: [a, a, a] }), []);
  assert.match(DF.judgeAcross({ rows: [a, { shared: DF.sharedOf(b2) }] }).join(), /2 forms/);
});
