'use strict';
/**
 * p6 / p7 "Exploring Your Type Hypothesis" — AUDIT SCRATCH, NOT A GATE.
 *
 * Written for docs/audit_pr3_explore_pages.md (13 Aug 2026).
 *
 * WHY THIS MEASURES MOCKUPS AND NOT THE RENDERER. p6 and p7 do not exist in app/renderer.js.
 * V3_PAGE_ORDER reserves sheets 6 and 7 (keys `typeA` / `typeB`) with titles and footer
 * numbers, but buildClientReportHTML_v3 emits seven pages and there is no _clv3TypeA or
 * _clv3TypeB. The only renderable source for these two sheets is the mockup pair
 * docs/mockup/claude_The_Peacemaker_Page_LeadingType_{A,B}_v1.html, whose eyebrows match
 * V3_PAGE_ORDER's sheet 6 and 7 titles exactly and whose content is Type 9.
 *
 * Reports, per page:
 *   1. HEADROOM      — 1056 minus the natural stack height, min-height released then restored.
 *   2. COLUMN WIDTHS — the available line width of every text zone, measured by forcing a wrap
 *                      rather than reading getBoundingClientRect(), because flex and inline-
 *                      block children shrink to their content and under-report the space they
 *                      actually had.
 *   3. ZONE INVENTORY— every text-bearing element, its class, count, font, and current Type 9
 *                      character length, so authored-vs-chrome can be classified from data.
 *
 *   node scripts/spike/explore_pages_probe.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const bl = require(path.join(ROOT, 'app/browser_launch.js'));

const PAGE_PX = 1056;
const OUT = path.join(ROOT, '.phase6_out');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { key: 'p6', sheet: 6, label: 'Exploring A', file: 'claude_The_Peacemaker_Page_LeadingType_A_v1.html' },
  { key: 'p7', sheet: 7, label: 'Exploring B', file: 'claude_The_Peacemaker_Page_LeadingType_B_v1.html' },
];

/** Runs in the page. Every number below comes from a layout box. */
function probe(PAGE_PX) {
  // The page shell. The mockups use .page (v3 shell: 816x1056, padding 40px 53px).
  const shell = document.querySelector('.page') || document.body.firstElementChild;

  const prevMin = shell.style.minHeight;
  const prevH = shell.style.height;
  shell.style.minHeight = '0px';
  shell.style.height = 'auto';
  const natural = shell.getBoundingClientRect().height;
  shell.style.minHeight = prevMin;
  shell.style.height = prevH;

  // Line boxes via a Range: one rect per line, merged by top edge so an inline span inside a
  // line does not count as an extra line.
  const lineRects = (n) => {
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const raw = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    const byTop = new Map();
    for (const r of raw) {
      const k = Math.round(r.top * 2) / 2;
      const cur = byTop.get(k);
      if (!cur) byTop.set(k, { left: r.left, right: r.right });
      else { cur.left = Math.min(cur.left, r.left); cur.right = Math.max(cur.right, r.right); }
    }
    return [...byTop.values()].map(r => ({ width: r.right - r.left }));
  };

  // COLUMN WIDTH — three readings, because no single one is trustworthy on its own.
  //
  //   contentBox  clientWidth minus horizontal padding, NO mutation. This is the width the
  //               wrap algorithm actually works against, and it is what the 12 Aug audit
  //               reported. Correct for block-level zones.
  //   maxLine     the widest line box of the CURRENT Type 9 text, no mutation. Only
  //               meaningful where the zone already wraps; it is a lower bound on contentBox,
  //               short by up to one trailing word.
  //   stuffed     the widest line box after filling the node with short words.
  //
  // `stuffed` is reported ONLY to expose where it disagrees with contentBox. Stuffing text
  // into a flex or inline-block child that sizes to its content makes the child grow, so the
  // number that comes back is a width the element never had in the real layout. Any zone
  // where stuffed > contentBox is a zone whose width must be read from contentBox.
  const widths = (n) => {
    const cs = getComputedStyle(n);
    const contentBox = n.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const cur = lineRects(n);
    const maxLine = cur.length ? Math.max(...cur.map(r => r.width)) : 0;
    const prev = n.innerHTML;
    n.textContent = Array(120).fill('lorem ipsum dolor sit amet').join(' ');
    const st = lineRects(n);
    const stuffed = st.length ? Math.max(...st.map(r => r.width)) : 0;
    n.innerHTML = prev;
    return { contentBox: +contentBox.toFixed(2), maxLine: +maxLine.toFixed(2), stuffed: +stuffed.toFixed(2) };
  };

  // Every element whose own text is a leaf (no element children carrying text).
  const isTextLeaf = (el) => {
    if (!el.textContent.trim()) return false;
    return [...el.children].every(c => !c.textContent.trim());
  };

  const seen = new Map();
  for (const el of shell.querySelectorAll('*')) {
    if (!isTextLeaf(el)) continue;
    const cls = el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : `<${el.tagName.toLowerCase()}>`;
    const cs = getComputedStyle(el);
    const rec = seen.get(cls) || {
      cls, tag: el.tagName.toLowerCase(), n: 0,
      font: `${parseFloat(cs.fontSize)}/${cs.fontWeight}`,
      lineHeight: +parseFloat(cs.lineHeight).toFixed(2),
      ...widths(el),
      lens: [], lines: [],
    };
    rec.n++;
    rec.lens.push(el.textContent.trim().length);
    rec.lines.push(lineRects(el).length);
    seen.set(cls, rec);
  }

  return {
    natural: +natural.toFixed(2),
    headroom: +(PAGE_PX - natural).toFixed(2),
    rendered: +shell.getBoundingClientRect().height.toFixed(2),
    zones: [...seen.values()].sort((a, b) => b.contentBox - a.contentBox),
  };
}

(async () => {
  const browser = await bl.launchBrowser();
  const results = {};
  try {
    for (const P of PAGES) {
      const file = path.join(ROOT, 'docs/mockup', P.file);
      const html = fs.readFileSync(file, 'utf8');
      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      await bl.assertReportFont(page);
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      await new Promise(r => setTimeout(r, 150));
      const m = await page.evaluate(probe, PAGE_PX);
      results[P.key] = { ...P, ...m };
      await page.pdf({ path: path.join(OUT, `explore_${P.key}_type9.pdf`), printBackground: true,
        width: '816px', height: '1056px', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      await page.close();
    }
  } finally { await browser.close(); }

  for (const key of ['p6', 'p7']) {
    const r = results[key];
    console.log(`\n=== ${key.toUpperCase()} sheet ${r.sheet} · ${r.label} · ${r.file} ===`);
    console.log(`  rendered ${r.rendered}px · natural stack ${r.natural}px · HEADROOM ${r.headroom}px`);
    console.log(`\n  zone (class)              n   font    lh    contentBox  maxLine  stuffed  T9 chars    lines  flag`);
    for (const z of r.zones) {
      const lens = z.lens.length > 4 ? `${Math.min(...z.lens)}-${Math.max(...z.lens)}` : z.lens.join(',');
      const lines = [...new Set(z.lines)].sort().join('/');
      const flag = z.stuffed > z.contentBox + 1 ? '  <-- stuffed inflates: use contentBox' : '';
      console.log(`  ${z.cls.padEnd(24)} ${String(z.n).padStart(2)}  ${z.font.padEnd(8)}${String(z.lineHeight).padStart(5)}  `
        + `${String(z.contentBox).padStart(9)} ${String(z.maxLine).padStart(8)} ${String(z.stuffed).padStart(8)}  ${lens.padStart(9)} ${lines.padStart(7)}${flag}`);
    }
  }

  fs.writeFileSync(path.join(OUT, 'explore_pages_probe.json'), JSON.stringify(results, null, 2));
  console.log('\nwrote .phase6_out/explore_pages_probe.json + 2 PDFs');
})().catch(e => { console.error('PROBE FAILED:', e.stack || e.message); process.exit(1); });
