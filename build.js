const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const assets = path.join(root, 'assets');
const bundle = path.join(assets, 'app.bundle.js');
const output = path.join(assets, 'app.min.js');
const cssOutput = path.join(assets, 'styles.min.css');
const sources = [
  'src/core.js',
  'src/model.js',
  'src/render.js',
  'src/events.js',
  'src/snapshot.js',
  'src/advisor.js',
  'src/donate.js',
  'src/main.js'
];
const terser = require.resolve('terser/bin/terser');
const cleancss = require.resolve('clean-css-cli/bin/cleancss');

fs.mkdirSync(assets, { recursive: true });
try {
  fs.writeFileSync(bundle, sources.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n'));
  execFileSync(process.execPath, [terser, bundle, '-c', '-m', '-o', output], { stdio: 'inherit' });
  execFileSync(process.execPath, [cleancss, path.join(root, 'styles.css'), '-o', cssOutput], { stdio: 'inherit' });
} finally {
  if (fs.existsSync(bundle)) fs.unlinkSync(bundle);
}
