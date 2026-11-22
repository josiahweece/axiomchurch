// Tell Bing (and other IndexNow engines) that pages changed.
// Run after a push goes live:  node tools/indexnow.js            (every URL in sitemap.xml)
//                              node tools/indexnow.js /christmas  (just these paths)
const fs = require('fs');
const path = require('path');
const KEY = 'f0cc12b77a6a823f18d83fcbaf8d25e8';
const HOST = 'www.axiomchurch.com';
const root = path.join(__dirname, '..');

let urls = process.argv.slice(2).map(p => 'https://' + HOST + (p.startsWith('/') ? p : '/' + p));
if (!urls.length) {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls })
}).then(r => console.log('IndexNow:', r.status, r.statusText, '-', urls.length, 'URLs'))
  .catch(e => { console.error('IndexNow failed:', e.message); process.exit(1); });
