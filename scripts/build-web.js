// Android アプリに同梱する Web ファイルを www/ にコピーする
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'css', 'js']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// アプリ（Android / iOS）に同梱するときは、Web 版だけの部分（Google Play へのリンク、撮影・動作確認用のフック）を取り除く。
// iOS の審査では、他社ストアへのリンクとそれをアプリで隠すコードがバンドルにあると「審査中に隠した機能」（Guideline 5.6）と見なされるため、
// アプリには最初から入れない。目印：HTML は <!-- web-only --> … <!-- /web-only -->、JS は // web-only:start … // web-only:end
if (process.env.APP_BUILD === '1') {
  const strip = (rel, re) => {
    const file = path.join(out, rel);
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(re, '');
    if (after === before) {
      console.error(`${rel} に web-only の目印が見つかりません`);
      process.exit(1);
    }
    fs.writeFileSync(file, after);
  };
  strip('index.html', /[ \t]*<!-- web-only[\s\S]*?<!-- \/web-only -->\n?/g);
  strip('js/game.js', /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end\n?/g);
  strip('js/i18n.js', /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end\n?/g);
  for (const rel of ['index.html', 'js/game.js', 'js/i18n.js']) {
    const text = fs.readFileSync(path.join(out, rel), 'utf8');
    if (/play\.google\.com|apps\.apple\.com|web-only|KOKUDO|hires|location\.search/.test(text)) {
      console.error(`${rel} に Web 版だけの部分が残っています`);
      process.exit(1);
    }
  }
}
// Google Play / App Store 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
if (mode === 'production') {
  // 本番の ID を入れ忘れたまま、ストア用のビルドを作らないようにする。ADMOB_PLATFORM（android / ios）で確かめる側を決める（未指定なら両方）
  const target = process.env.ADMOB_PLATFORM;
  const problems = [];
  if (target !== 'ios') {
    const strings = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'), 'utf8');
    if (strings.includes('ca-app-pub-3940256099942544')) problems.push('android/app/src/main/res/values/strings.xml の admob_app_id（テスト用のまま）');
  }
  if (target !== 'android') {
    const plist = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
    if (plist.includes('ca-app-pub-3940256099942544')) problems.push('ios/App/App/Info.plist の GADApplicationIdentifier（テスト用のまま）');
  }
  if (problems.length) {
    console.error(`本番の AdMob の ID が設定されていません: ${problems.join('、')}`);
    process.exit(1);
  }
}
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${process.env.APP_BUILD === '1' ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
