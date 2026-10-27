// Google AdMob 広告（Android / iOS アプリのときだけ動く。Web 版では何もしない）
const Ads = (() => {
  // AdMob では Android と iOS を別のアプリとして登録しているので、広告ユニットも OS ごとに分かれている。
  // test は Google 公式のテスト用広告ユニット。空欄の広告は本番ビルドでは出さない（広告ユニットを作ったらここに入れる）
  const UNITS = {
    android: {
      test: {
        banner: 'ca-app-pub-3940256099942544/6300978111',
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
      },
      production: {
        banner: 'ca-app-pub-6411535997477460/3749535054',
        interstitial: 'ca-app-pub-6411535997477460/4172955315',
        rewarded: 'ca-app-pub-6411535997477460/2838943918',
      },
    },
    ios: {
      test: {
        banner: 'ca-app-pub-3940256099942544/2934735716',
        interstitial: 'ca-app-pub-3940256099942544/4411468910',
        rewarded: 'ca-app-pub-3940256099942544/1712485313',
      },
      production: {
        banner: '',
        interstitial: '',
        rewarded: '',
      },
    },
  };
  const RETRY_MS = 20000;      // 読み込みに失敗したら少し待って再挑戦する
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const platform = native && cap.getPlatform && cap.getPlatform() === 'ios' ? 'ios' : 'android';
  const testing = window.AD_MODE !== 'production';
  const ids = UNITS[platform][testing ? 'test' : 'production'];
  const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
  const has = { banner: !!(AdMob && ids.banner), inter: !!(AdMob && ids.interstitial), reward: !!(AdMob && ids.rewarded) };

  let ready = false;           // 広告をリクエストしてよい状態（初期化と同意確認が済んだ）
  let showing = false;
  let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか（EU など）
  const waiters = {};          // 表示中の広告が閉じたときに呼ぶ処理

  // 広告の種類ごとの読み込み状態
  const slots = {
    inter: { loaded: false, pending: null, load: () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: testing }) },
    reward: { loaded: false, pending: null, load: () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: testing }) },
  };

  // 読み込みを始め、読み込めたら true で resolve する Promise を返す（読み込み中なら同じ Promise）
  function prepare(kind) {
    const s = slots[kind];
    if (!ready) return Promise.resolve(false);
    if (s.loaded) return Promise.resolve(true);
    if (!s.pending) {
      s.pending = s.load()
        .then(() => { s.loaded = true; return true; })
        .catch(() => { setTimeout(() => prepare(kind), RETRY_MS); return false; })
        .finally(() => { s.pending = null; });
    }
    return s.pending;
  }

  // 読み込み済みでなければ、最大 timeout ミリ秒だけ読み込みを待つ
  function ensureLoaded(kind, timeout) {
    if (slots[kind].loaded) return Promise.resolve(true);
    return Promise.race([prepare(kind), new Promise(r => setTimeout(() => r(false), timeout))]);
  }

  function finish(kind, result) {
    showing = false;
    Sound.resume();
    applyBanner();
    const w = waiters[kind];
    waiters[kind] = null;
    if (w) w(result);
  }

  async function init() {
    try {
      await AdMob.initialize({ initializeForTesting: testing });
    } catch (e) {
      return;
    }
    // EU・英国などで必要な広告の同意確認（必要な地域でだけフォームが出る）。
    // 確認自体が失敗した場合（AdMob 側でメッセージ未設定など）は、同意不要の地域とみなして続ける
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.status === 'REQUIRED' && consent.isConsentFormAvailable) consent = await AdMob.showConsentForm();
      ready = consent.canRequestAds !== false;
      privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) {
      ready = true;
    }
    // iOS では、広告用の ID を使ってよいか（App Tracking Transparency）を利用者に確認する。
    // 同意確認のあとに一度だけ出る。断られても広告は出せる（パーソナライズされないだけ）
    if (platform === 'ios') {
      try {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) { /* noop */ }
    }
    let rewarded = false;
    AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
    AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
    AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
    AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
    AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
    AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
    // バナーの高さに合わせて、画面下の要素がバナーに隠れないようにする（単位は CSS の px と同じ dp）
    AdMob.addListener('bannerAdSizeChanged', info => {
      document.documentElement.style.setProperty('--ad-h', `${(info && info.height) || 0}px`);
    });
    if (has.inter) prepare('inter');
    if (has.reward) prepare('reward');
    applyBanner();
  }

  // ---------------------------------------------------------------- バナー
  // タイトル・ポーズ・結果画面の下に出す。プレイ中や全画面広告の表示中は隠す
  // setBanner は毎フレーム呼ばれるので、状態が変わったときだけ AdMob を操作する
  let bannerWanted = false;
  let bannerState = 'none';   // none（未作成）/ shown / hidden
  let bannerBusy = false;
  let bannerRetryAt = 0;      // 表示に失敗したら少し待って再挑戦する
  function setBanner(on) {
    if (!has.banner) return;
    bannerWanted = on;
    applyBanner();
  }
  async function applyBanner() {
    if (!has.banner || !ready || bannerBusy) return;
    const want = bannerWanted && !showing;
    if (want === (bannerState === 'shown')) return;
    if (want && bannerState === 'none' && Date.now() < bannerRetryAt) return;
    bannerBusy = true;
    try {
      if (want && bannerState === 'none') {
        await AdMob.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testing });
        bannerState = 'shown';
      } else if (want) {
        await AdMob.resumeBanner();
        bannerState = 'shown';
      } else if (bannerState === 'shown') {
        await AdMob.hideBanner();
        bannerState = 'hidden';
        document.documentElement.style.setProperty('--ad-h', '0px');
      }
    } catch (e) {
      bannerState = 'none';
      bannerRetryAt = Date.now() + RETRY_MS;
      try { await AdMob.removeBanner(); } catch (e2) { /* noop */ }
    }
    bannerBusy = false;
    applyBanner();   // 処理中に画面が切り替わっていたら合わせ直す
  }

  // 全画面広告を表示し、閉じられたら resolve する（読み込めていないときは出さずにすぐ resolve）
  function showInterstitial() {
    if (!has.inter || !ready || !slots.inter.loaded || showing) return Promise.resolve();
    showing = true; slots.inter.loaded = false;
    Sound.suspend();
    applyBanner();
    return new Promise(resolve => {
      waiters.inter = () => { prepare('inter'); resolve(); };
      AdMob.showInterstitial().catch(() => finish('inter'));
    });
  }

  // リワード広告を表示する。結果は 'rewarded'（最後まで見た）/ 'skipped'（途中で閉じた）/ 'unavailable'（読み込めなかった）
  async function showRewarded() {
    if (!has.reward || showing) return 'unavailable';
    await initDone;
    if (!ready || !(await ensureLoaded('reward', 8000))) return 'unavailable';
    showing = true; slots.reward.loaded = false;
    Sound.suspend();
    applyBanner();
    return new Promise(resolve => {
      waiters.reward = ok => { prepare('reward'); resolve(ok ? 'rewarded' : 'skipped'); };
      AdMob.showRewardVideoAd().catch(() => finish('reward', false));
    });
  }

  // 同意した内容をあとから変更するための Google のフォームを開く
  function showPrivacyOptions() {
    if (!AdMob) return Promise.resolve();
    return AdMob.showPrivacyOptionsForm().catch(() => {});
  }

  const initDone = AdMob ? init() : Promise.resolve();

  return {
    get available() { return !!AdMob; },
    get canInterstitial() { return has.inter; },
    get canReward() { return has.reward; },
    get showing() { return showing; },
    get privacyOptionsRequired() { return privacyRequired; },
    initDone,
    showInterstitial,
    showRewarded,
    showPrivacyOptions,
    setBanner,
  };
})();
