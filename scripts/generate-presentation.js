/**
 * Generates a simple, non-technical 10-slide deck about GeoTraffic / Traffic-GeoAI.
 * Run: node scripts/generate-presentation.js
 * Output: presentations/GeoTraffic-Overview.pptx
 */

const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const outDir = path.join(__dirname, '..', 'presentations');
const outFile = path.join(outDir, 'GeoTraffic-Overview.pptx');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Traffic-GeoAI';
pptx.title = 'GeoTraffic Overview';

const accent = '1E40AF';
const muted = '64748B';

function titleSlide(title, subtitle) {
  const s = pptx.addSlide();
  s.background = { color: 'F8FAFC' };
  s.addText(title, {
    x: 0.6,
    y: 2.2,
    w: 12.3,
    h: 1.4,
    fontSize: 36,
    bold: true,
    color: '0F172A',
    fontFace: 'Arial',
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.6,
      y: 3.8,
      w: 12.3,
      h: 1,
      fontSize: 20,
      color: muted,
      fontFace: 'Arial',
    });
  }
  return s;
}

function bulletSlide(title, bullets) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addText(title, {
    x: 0.6,
    y: 0.45,
    w: 12.3,
    h: 0.9,
    fontSize: 28,
    bold: true,
    color: accent,
    fontFace: 'Arial',
  });
  s.addText(bullets.map((b) => ({ text: b, options: { bullet: true } })), {
    x: 0.75,
    y: 1.5,
    w: 11.8,
    h: 5.5,
    fontSize: 20,
    color: '334155',
    fontFace: 'Arial',
    valign: 'top',
    lineSpacingMultiple: 1.35,
  });
  return s;
}

function twoColumnSlide(title, leftTitle, leftLines, rightTitle, rightLines) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addText(title, {
    x: 0.6,
    y: 0.45,
    w: 12.3,
    h: 0.9,
    fontSize: 28,
    bold: true,
    color: accent,
    fontFace: 'Arial',
  });
  s.addText(leftTitle, {
    x: 0.6,
    y: 1.35,
    w: 5.8,
    h: 0.45,
    fontSize: 18,
    bold: true,
    color: '0F172A',
    fontFace: 'Arial',
  });
  s.addText(leftLines.map((t) => ({ text: t, options: { bullet: true } })), {
    x: 0.65,
    y: 1.85,
    w: 5.75,
    h: 4.8,
    fontSize: 17,
    color: '334155',
    fontFace: 'Arial',
    valign: 'top',
    lineSpacingMultiple: 1.3,
  });
  s.addText(rightTitle, {
    x: 6.85,
    y: 1.35,
    w: 5.8,
    h: 0.45,
    fontSize: 18,
    bold: true,
    color: '0F172A',
    fontFace: 'Arial',
  });
  s.addText(rightLines.map((t) => ({ text: t, options: { bullet: true } })), {
    x: 6.9,
    y: 1.85,
    w: 5.75,
    h: 4.8,
    fontSize: 17,
    color: '334155',
    fontFace: 'Arial',
    valign: 'top',
    lineSpacingMultiple: 1.3,
  });
  return s;
}

// --- 10 slides ---
titleSlide('GeoTraffic', 'A friendly look at roads, signals, and “busy-ness” near any place you choose');

bulletSlide('Why this app exists', [
  'Cities are full of roads, lights, stops, and crossings.',
  'Planners, students, and curious people often ask: “How complex is this area?”',
  'This tool gives a simple picture of what is on the map around a point—or along a drive.',
]);

bulletSlide('What you actually get', [
  'A map with a circle (area mode) or a driving path (route mode).',
  'A short summary: how many signals, stops, and similar features were found.',
  'A single score that suggests how “busy” the infrastructure feels—not your phone’s live traffic.',
]);

twoColumnSlide(
  'Two ways to explore',
  'Area around a spot',
  [
    'Pick a center on the map (or type coordinates).',
    'Choose a small radius (for example, a few blocks up to about one mile).',
    'Press analyze to see what OpenStreetMap lists nearby.',
  ],
  'Along a drive',
  [
    'Set a start and end.',
    'The app draws a driving path and looks at what sits near that path.',
    'Useful when you care about a corridor, not just one point.',
  ],
);

bulletSlide('Where the information comes from', [
  'Data is pulled from OpenStreetMap—a free, community-built map of the world.',
  'It includes traffic lights, bus stops, rail stations, bridges, and road types.',
  'It does not read live congestion from cars or phones. Think “map facts,” not “traffic jam right now.”',
]);

bulletSlide('What the app does with that data', [
  'It counts relevant features (for example, signals and intersections).',
  'It looks at road types (big roads vs. small streets).',
  'It blends those into one congestion-style score and a simple label (like Light or Moderate).',
  'Scores use static map data only—no live traffic feeds and no time-of-day multiplier.',
]);

bulletSlide('What you should not expect', [
  'Not real-time Google Maps–style traffic or accident reports.',
  'Not official city planning approval—only an educational snapshot.',
  'Results depend on how complete the local map is; rural areas may show fewer features.',
]);

bulletSlide('Who might use this', [
  'Students explaining urban form or a class project.',
  'Anyone comparing two neighborhoods in a simple, visual way.',
  'Teams prototyping ideas before investing in heavier data tools.',
]);

titleSlide('Thank you', 'Questions? We’re happy to walk through the map and the scores in plain language.');

pptx.writeFile({ fileName: outFile })
  .then(() => {
    console.log('Wrote:', outFile);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
