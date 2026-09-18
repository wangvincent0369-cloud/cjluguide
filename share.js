/* ============================================================
   分享给同学 share.js —— 纯前端，被 8 个页面引用（</body> 前）
   ------------------------------------------------------------
   作用：在每页结尾卡（.cta-card 或首页 .ask）下方注入一个低调分享条：
   「觉得这份指南有用？/ 可以发给同学，一起准备开学。」
   - 手机支持系统原生分享（navigator.share）就优先用；
   - 不支持或用户点「复制链接」→ 复制当前页链接到剪贴板。
   不做弹窗、不自动开微信、不要求登录。
   浅色页面（luggage）自动切换深色文字配色。
   ============================================================ */
(function () {
  'use strict';

  var TITLE = '中国计量大学 2026 新生指南';
  var TEXT = '开学要准备的东西我都整理好了，可以对着看，省得一个个问。';

  function currentURL() { return location.href; }

  function isLightBg(el) {
    var c = getComputedStyle(el).backgroundColor;   /* 形如 rgb(15, 23, 42) */
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (!m) return false;
    var lum = 0.299 * (+m[1]) + 0.587 * (+m[2]) + 0.114 * (+m[3]);
    return lum > 160;
  }

  function copyText(txt, okFn, failFn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(okFn, function () { legacyCopy(txt, okFn, failFn); });
    } else {
      legacyCopy(txt, okFn, failFn);
    }
  }
  function legacyCopy(txt, okFn, failFn) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    /* ⚠️ execCommand 会返回 false 表示失败。以前不管成败都调 okFn，于是失败也显示
       "链接已复制"，用户去微信粘贴发现是空的。（2026-09-16 修，和 contact.js 同一处毛病） */
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) { okFn(); } else if (failFn) { failFn(); }
  }

  function buildCard() {
    var card = document.createElement('div');
    card.className = 'sh-card';

    var t = document.createElement('div');
    t.className = 'sh-t';
    t.textContent = '觉得这份指南有用？';
    card.appendChild(t);

    var s = document.createElement('div');
    s.className = 'sh-s';
    s.textContent = '可以发给同学，一起准备开学。';
    card.appendChild(s);

    var btns = document.createElement('div');
    btns.className = 'sh-btns';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sh-btn sh-primary';
    btn.textContent = '分享给同学';
    btn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({
          title: document.title || TITLE,
          text: TEXT,
          url: currentURL()
        }).catch(function () { /* 用户取消分享，不做任何事 */ });
      } else {
        copyText(currentURL(), showState, showFail);
      }
    });
    btns.appendChild(btn);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'sh-btn sh-copy';
    copyBtn.textContent = '复制链接';
    copyBtn.addEventListener('click', function () {
      copyText(currentURL(), showState, showFail);
    });
    btns.appendChild(copyBtn);

    /* ---- 扫码分享：展开当前页二维码（qr-<页名>.png，与本页同目录）---- */
    var qrName = 'qr-' + ((location.pathname.split('/').pop() || 'index.html')
      .replace(/\.html?$/, '') || 'index') + '.png';

    var qrBtn = document.createElement('button');
    qrBtn.type = 'button';
    qrBtn.className = 'sh-btn sh-copy';
    qrBtn.textContent = '扫码分享';

    var qrBox = document.createElement('div');
    qrBox.className = 'sh-qr';
    qrBox.hidden = true;

    var qrImg = document.createElement('img');
    qrImg.src = qrName;
    qrImg.alt = '本页二维码';
    qrImg.loading = 'lazy';
    /* 本页的码还没做出来时，退回用整站首页码（宁可码指向首页，也别让按钮凭空消失）；
       连首页码都取不到才把按钮藏起来 */
    qrImg.onerror = function () {
      if (qrImg.getAttribute('data-fb')) { qrBtn.hidden = true; return; }
      qrImg.setAttribute('data-fb', '1');
      qrImg.src = 'qr-index.png';
    };

    var qrTip = document.createElement('div');
    qrTip.className = 'sh-qr-t';
    qrTip.textContent = '让同学扫这个码，直接打开这一页；手机上长按图片可以保存';

    qrBox.appendChild(qrImg);
    qrBox.appendChild(qrTip);

    qrBtn.addEventListener('click', function () {
      qrBox.hidden = !qrBox.hidden;
      qrBtn.textContent = qrBox.hidden ? '扫码分享' : '收起二维码';
    });

    btns.appendChild(qrBtn);
    card.appendChild(btns);
    card.appendChild(qrBox);

    var state = document.createElement('div');
    state.className = 'sh-state';
    state.setAttribute('aria-live', 'polite');
    card.appendChild(state);

    var showState = function () {
      state.textContent = '链接已复制，去微信粘贴发给同学即可 ✓';
      state.hidden = false;
      clearTimeout(showState._t);
      showState._t = setTimeout(function () { state.hidden = true; }, 2600);
    };
    /* 复制失败必须说出来，不能沉默：否则用户以为复制好了，去微信粘出来是空的 */
    var showFail = function () {
      state.textContent = '没复制成功，请手动长按选中地址栏里的网址';
      state.hidden = false;
      clearTimeout(showState._t);
      showState._t = setTimeout(function () { state.hidden = true; }, 3600);
    };
    card._state = state;   /* 闭包里 showState 定义在后，先引用函数声明即可 */
    return card;
  }

  function placeCard() {
    var anchor = document.querySelector('.cta-card') || document.querySelector('.ask');
    var card = buildCard();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    } else {
      var foot = document.querySelector('.footer');
      if (foot && foot.parentNode) foot.parentNode.insertBefore(card, foot);
      else document.body.appendChild(card);
    }
    if (isLightBg(document.body)) card.classList.add('sh-light');
    /* 切白天/黑夜后重新判断一次底色，否则深色文字会落在浅底上（或反过来）看不清 */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        card.classList.toggle('sh-light', isLightBg(document.body));
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return card;
  }

  var CSS = '' +
    '.sh-card{max-width:var(--w-narrow);margin:24px auto 0;padding:var(--gap-2xl) var(--gap-xl) var(--gap-xl);text-align:center;' +
    'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:var(--r-md)}' +
    '.sh-t{color:#E2E8F0;font-weight:700;font-size:var(--fs-lg);letter-spacing:.3px}' +
    '.sh-s{color:rgba(255,255,255,.55);font-size:var(--fs-xs);margin-top:var(--gap-xs);line-height:var(--lh)}' +
    '.sh-btns{display:flex;justify-content:center;gap:var(--gap-md);margin-top:var(--gap-lg);flex-wrap:wrap}' +
    '.sh-btn{border:none;cursor:pointer;font-family:inherit;font-size:var(--fs-sm);font-weight:600;' +
    'border-radius:var(--r-sm);padding:var(--gap-md) var(--gap-2xl);-webkit-tap-highlight-color:transparent}' +
    '.sh-primary{background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff}' +
    '.sh-primary:hover{filter:brightness(1.08)}' +
    '.sh-copy{background:rgba(255,255,255,.07);color:#93C5FD;border:1px solid rgba(255,255,255,.18)}' +
    '.sh-copy:hover{background:rgba(96,165,250,.14)}' +
    '.sh-state{color:#34D399;font-size:var(--fs-xs);margin-top:var(--gap-md)}' +
    '.sh-qr{margin-top:var(--gap-lg)}' +
    '.sh-qr[hidden]{display:none}' +
    /* 二维码：白边就是扫码的静默区，16px + 图自带留白 ≈ 5 个模块（标准要 ≥4）；
       height:auto + aspect-ratio + object-fit 三重保险，窄屏和换图都不会被拉变形 */
    '.sh-qr img{width:180px;height:auto;aspect-ratio:1/1;object-fit:contain;box-sizing:border-box;' +
    'max-width:60vw;background:#fff;padding:var(--gap-xl);' +
    'border-radius:var(--r-md);display:block;margin:0 auto}' +
    '.sh-qr-t{color:rgba(255,255,255,.5);font-size:var(--fs-xs);margin-top:var(--gap);line-height:var(--lh)}' +
    '.sh-card.sh-light .sh-qr-t{color:rgba(15,23,42,.72)}' +
    '.sh-card.sh-light{background:rgba(15,23,42,.05);border-color:rgba(15,23,42,.18)}' +
    '.sh-card.sh-light .sh-t{color:#1E293B}' +
    '.sh-card.sh-light .sh-s{color:rgba(15,23,42,.72)}' +
    '.sh-card.sh-light .sh-copy{color:#2563EB;background:rgba(15,23,42,.05);border-color:rgba(15,23,42,.16)}' +
    '@media(max-width:640px){.sh-card{margin:18px auto 0}}' +
    /* ---------- 主题化覆盖（2026-09-16 修）----------
       上面整套原先写死深色，再靠 .sh-light 打补丁；补丁用的是 rgba(15,23,42,.05) 这类灰，
       结果白天模式下卡片是灰的、「复制链接 / 扫码分享」是灰底灰边的老式按钮，跟页面蓝色系完全不搭。
       统一改用 theme.css 变量：白天/夜间自动切换，两套补丁随之失效（选择器同优先级、后写生效）。 */
    '.sh-card,.sh-card.sh-light{background:var(--card);border-color:var(--line2)}' +
    '.sh-t,.sh-card.sh-light .sh-t{color:var(--text)}' +
    '.sh-s,.sh-card.sh-light .sh-s{color:var(--sub)}' +
    '.sh-primary{background:linear-gradient(135deg,var(--accent),var(--purple));color:#fff}' +
    '.sh-copy,.sh-card.sh-light .sh-copy{background:var(--brand-soft);color:var(--accent);border-color:var(--brand-line)}' +
    '.sh-copy:hover{background:var(--brand-line);color:var(--accent)}' +
    '.sh-state{color:var(--green)}' +
    '.sh-qr-t,.sh-card.sh-light .sh-qr-t{color:var(--sub)}';

  function injectStyle() {
    if (document.getElementById('sh-style')) return;
    var st = document.createElement('style');
    st.id = 'sh-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function mount() {
    try {
      injectStyle();
      placeCard();
    } catch (e) { /* 不拖垮页面 */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
