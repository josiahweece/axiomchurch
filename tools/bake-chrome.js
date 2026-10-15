// Copies the site header (menu) and footer that js/main.js draws into each page's
// HTML, so the menu, address and nonprofit line are in the page itself. Search
// engines, Google's Ad Grants review and anything else that reads a page without
// running JavaScript then see the full site. main.js still redraws both on load,
// with the same markup, so nothing changes for people.
// Run after changing the menu or footer in js/main.js:  node tools/bake-chrome.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8').split('\n');
const end = src.findIndex((l) => l.includes("querySelector('[data-footer]').innerHTML"));
const builder = src.slice(1, end + 1).join('\n'); // body of the first block, up to the footer
const MARK = /(<div data-(header|footer)>)[\s\S]*?(<!--\/baked-->)?<\/div>(?=\s*(?:<main|<script|<div|<section|\n))/;
function render(page) {
  const out = {};
  const el = (k) => ({ set innerHTML(v) { out[k] = v; } });
  const document = { head: { insertAdjacentHTML() {} }, querySelector: (s) => el(s.includes('header') ? 'header' : 'footer') };
  const location = { pathname: '/' + page };
  new Function('document', 'location', builder)(document, location);
  return out;
}
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
let n = 0;
for (const f of pages) {
  const file = path.join(root, f);
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('data-header') && !s.includes('data-footer')) continue;
  const o = render(f);
  for (const k of ['header', 'footer']) {
    const open = `<div data-${k}>`;
    const i = s.indexOf(open);
    if (i < 0) continue;
    // find the matching </div> for this wrapper
    let depth = 0, j = i;
    const re = /<div\b|<\/div>/g; re.lastIndex = i;
    let m;
    while ((m = re.exec(s))) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) { j = m.index; break; } }
    s = s.slice(0, i) + open + o[k] + s.slice(j);
  }
  fs.writeFileSync(file, s); n++;
}
console.log('baked header and footer into', n, 'pages');
