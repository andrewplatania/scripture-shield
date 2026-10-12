const fs = require('fs');
const path = require('path');

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
  'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
];
const PSALM = BOOKS.indexOf('Psalm');

const root = path.join(__dirname, '..');
const stripBom = (s) => s.replace(/^﻿/, '');

const kjv = JSON.parse(stripBom(fs.readFileSync(path.join(root, 'data', 'kjv.json'), 'utf8')));
if (kjv.length !== 66) throw new Error('Expected 66 books, got ' + kjv.length);

const bsb = new Map();
for (const line of stripBom(fs.readFileSync(path.join(root, 'data', 'bsb.txt'), 'utf8')).split(/\r?\n/)) {
  const m = /^(.+?) (\d+):(\d+)\t(.*)$/.exec(line);
  if (!m) continue;
  const book = BOOKS.indexOf(m[1]);
  if (book >= 0) bsb.set(`${book}|${m[2]}|${m[3]}`, m[4]);
}
if (bsb.size < 31000) throw new Error('BSB text looks incomplete: ' + bsb.size + ' verses');

const PSALM_TITLES = [
  /^For the choirmaster\. A Psalm of David\. When Nathan the prophet came to him after his adultery with Bathsheba\.\s+/,
  /^For the choirmaster\. Of the sons of Korah\. According to Alamoth\. A song\.\s+/,
  /^For the choirmaster\. A Psalm of David\.\s+/,
  /^Of David\.\s+/,
  /^A song of ascents\.\s+/,
];
const TITLE_LEFT = /^(For the choirmaster|A Psalm|Of David|A song|A Song|A Prayer|A Maskil|A Miktam|Of the sons)/;

const cleanKjv = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

function cleanBsb(s, book, verse) {
  let t = s;
  if (book === PSALM && verse === 1) for (const re of PSALM_TITLES) t = t.replace(re, '');
  return t.replace(/\s+/g, ' ').trim();
}

const refs = fs.readFileSync(path.join(__dirname, 'refs.txt'), 'utf8').split(/\r?\n/);
const refRe = /^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/;
const seen = new Set();
const out = [];

for (const raw of refs) {
  const line = raw.trim();
  if (!line) continue;
  const m = refRe.exec(line);
  if (!m) throw new Error('Bad reference: ' + line);
  const book = BOOKS.indexOf(m[1]);
  if (book < 0) throw new Error('Unknown book: ' + line);
  const ch = +m[2], v1 = +m[3], v2 = m[4] ? +m[4] : v1;
  if (v2 < v1) throw new Error('Reversed range: ' + line);
  const id = `${book}:${ch}:${v1}-${v2}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const chapter = kjv[book].chapters[ch - 1];
  if (!chapter) throw new Error('No such chapter: ' + line);
  const k = [];
  const b = [];
  for (let v = v1; v <= v2; v++) {
    if (chapter[v - 1] == null) throw new Error('No such KJV verse: ' + line + ' (verse ' + v + ')');
    k.push([v, cleanKjv(chapter[v - 1])]);
    const bt = bsb.get(`${book}|${ch}|${v}`);
    if (!bt) throw new Error('No BSB text for: ' + line + ' (verse ' + v + ')');
    const cleaned = cleanBsb(bt, book, v);
    if (TITLE_LEFT.test(cleaned) && book === PSALM && v === 1) throw new Error('Psalm title left in: ' + line);
    b.push([v, cleaned]);
  }
  out.push({ r: `${m[1]} ${ch}:${v1}${v2 !== v1 ? '-' + v2 : ''}`, kjv: k, bsb: b });
}

fs.writeFileSync(
  path.join(root, 'src', 'verses.js'),
  'window.VERSES = ' + JSON.stringify(out) + ';\n',
  'utf8'
);
console.log('Wrote', out.length, 'passages');
