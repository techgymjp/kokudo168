// App Store 配布用のプロビジョニングプロファイルを App Store Connect API で作り、この Mac に入れる。
// Xcode の自動署名に任せると、GitHub の Mac は毎回まっさらなので、実行のたびに開発用の証明書が新しく作られ、
// 上限（数枚）に達すると失敗する。登録済みの配布用証明書だけを使うプロファイルを自分で用意して、それを避ける。
//
// 使い方: node asc-appstore-profile.mjs <Bundle ID> <プロファイル名> <配布用証明書のシリアル番号（16進）>
// 環境変数: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH（.p8 のパス）
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [bundleId, profileName, certSerial] = process.argv.slice(2);
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!bundleId || !profileName || !certSerial || !ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
  console.error('引数か環境変数が足りません');
  process.exit(1);
}

// App Store Connect API の認証トークン（ES256 の JWT、有効期限 15 分）
function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' })}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: fs.readFileSync(ASC_KEY_PATH), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}

async function api(method, url, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error(`${method} ${url} → ${res.status}\n${await res.text()}`);
    process.exit(1);
  }
  return res.status === 204 ? null : res.json();
}

const normSerial = (s) => s.toUpperCase().replace(/[^0-9A-F]/g, '').replace(/^0+/, '');

const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&limit=200`);
const bundle = bundles.data.find((b) => b.attributes.identifier === bundleId);
if (!bundle) {
  console.error(`Bundle ID ${bundleId} が Apple Developer に登録されていません`);
  process.exit(1);
}

const certs = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200');
const cert = certs.data.find((c) => normSerial(c.attributes.serialNumber) === normSerial(certSerial));
if (!cert) {
  console.error('登録した配布用証明書（.p12）が Apple Developer に見つかりません。取り消されていないか確認してください');
  process.exit(1);
}

// 同じ名前の古いプロファイルは消してから作り直す（証明書を作り直したときも、これで追従する）
const old = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(profileName)}&limit=200`);
for (const p of old.data) await api('DELETE', `/v1/profiles/${p.id}`);

const created = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: profileName, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: cert.id }] },
    },
  },
});
const { uuid, profileContent } = created.data.attributes;
const dir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${uuid}.mobileprovision`), Buffer.from(profileContent, 'base64'));
console.log(`プロファイル「${profileName}」（${uuid}）を入れました`);
