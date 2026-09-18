/* ============================================================
   联系方式 contact.js —— 全站统一，被所有页面引用（</body> 前）
   ------------------------------------------------------------
   作用：每页底部的联系方式卡。内容全部读 config.js 的 window.SITE：

   · 配了 qrFile（群码图）→ 显示二维码卡（新生扫码进群）
   · 只配了 wx           → 微信号当主入口（点一下复制）
   · 两个都留空          → 显示占位说明卡，界面上不出现任何真实联系方式
                           （开源演示版默认状态：防爬虫收割维护者的联系方式）

   文案字段（标题 / 标签 / 群规等）按你的站自由改。
   ============================================================ */
(function () {
  'use strict';

  var SITE = window.SITE || {};

  var CFG = {
    /* ★ 二维码开关由 config.js 决定：配了 qrFile 就显示，否则只看 wx */
    showQR: !!SITE.qrFile,
    files: SITE.qrFile ? [SITE.qrFile] : [],

    /* 顶部小字署名：个人品牌只做弱化标注，不抢群本身的价值 */
    brand: SITE.brand || SITE.name || '你的署名',

    /* 主标题 + 副标题（有码 / 无码同一套文案） */
    qrTitle: '新生交流站',
    sub: '有问题，直接问；有靠谱信息，也可以分享',

    /* 二维码正下方的行动提示 */
    scanTip: '扫码加入',

    /* 三个小标签：说的是"群里是什么人、聊什么" */
    tags: ['都是本校同学', '报到 / 宿舍 / 生活', '有资料一起分享'],

    /* 群规（卡片底部可展开）：只写"群里不让干什么"，不写管理手法 */
    rulesTitle: '进群前看一眼：群里就三条规矩',
    rules: [
      '① 不发广告、链接、二维码（"加我微信领资料"这种也不行）',
      '② 不私加群友推销（有人截图给我，会移出）',
      '③ 不往别的群拉人'
    ],
    rulesNote: '有问题群里随便问，看到都会一起聊。',

    /* 底部兜底：微信号（整行可点，点了复制）—— config.js 留空则不出现 */
    wx:     SITE.wx || '',
    wxTip:  '加我微信（点这行复制）',
    wxNote: '加的时候备注「渠道+身份」，比如「新生」',

    /* 只有 showQR=true 且图片加载失败（群码过期 / 满人）时才用这句 */
    fallbackTitle: '群码过期了？加我微信拉你进群'
  };

  /* 时间戳：默认每次打开都重新取图（换图立刻生效）。
     想改成每小时更新一次，把下一行换成：
     return new Date().toISOString().slice(0, 13); */
  function TS() { return Date.now(); }

  /* ---- 依次尝试候选文件名，成功返回可用地址，全失败返回 null ----
     ⚠️ 每个图必须有超时兜底。只靠 onload / onerror 是危险的：微信里弱网、请求挂住时
     两个回调都不触发 → done 永不执行 → 卡片永远不生成 → 页面上就留下静态 HTML 里那句
     「长按复制 · 备注「XX」」，而那一版**没有绑点击处理**，真的只能长按。
     这才是"点击复制怎么不生效"的根因（2026-09-16 修）。 */
  function findQR(done) {
    var i = 0, settled = false;
    function finish(v) { if (!settled) { settled = true; done(v); } }
    (function next() {
      if (i >= CFG.files.length) { finish(null); return; }
      var url = CFG.files[i++];
      var probe = new Image();
      var timer = setTimeout(function () {
        probe.onload = probe.onerror = null;   /* 先摘回调，免得它过一会儿又活过来 */
        next();
      }, 3500);
      probe.onload = function () { clearTimeout(timer); finish(url); };
      probe.onerror = function () { clearTimeout(timer); next(); };
      probe.src = url + '?t=' + TS();
    })();
  }

  /* 底色算不算浅：从卡片将要落进去的位置往上找，第一个"看得见的背景"说了算。
     不能只看 body —— 浅色页面里也可能嵌一块深色卡（luggage 页就是），
     只看 body 会把文字转成深色，落在深底上就看不见了 */
  function isLightBg(el) {
    var e = el, guard = 0;
    while (e && e.nodeType === 1 && guard++ < 40) {
      var cs = getComputedStyle(e);
      /* 渐变色块：取所有色标算平均亮度 */
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        var g = cs.backgroundImage.match(/rgba?\([^)]+\)/g), sum = 0, n = 0;
        for (var i = 0; i < (g ? g.length : 0); i++) {
          var gm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(g[i]);
          if (gm) { sum += 0.299 * (+gm[1]) + 0.587 * (+gm[2]) + 0.114 * (+gm[3]); n++; }
        }
        if (n) return (sum / n) > 160;
      }
      /* 纯色块：半透明的跳过，继续往上找 */
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(cs.backgroundColor);
      if (m && (m[4] === undefined || parseFloat(m[4]) > 0.5)) {
        return (0.299 * (+m[1]) + 0.587 * (+m[2]) + 0.114 * (+m[3])) > 160;
      }
      e = e.parentElement;
    }
    return false;
  }

  function copy(text, okFn, failFn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(okFn, function () { fallback(text, okFn, failFn); });
    } else { fallback(text, okFn, failFn); }
  }
  function fallback(text, okFn, failFn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    /* ⚠️ execCommand 会返回 false 表示失败。以前是不管成败都调 okFn，
       于是失败也显示"已复制" —— 用户去粘贴发现是空的，就以为整个功能是坏的、
       干脆回去长按。现在分开处理：成功说复制好了，失败就明确告诉他手动长按复制（2026-09-16 修）。 */
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) { okFn(); } else if (failFn) { failFn(); }
  }

  /* ---- 造卡片 ----
     qrUrl 有值 = 显示二维码；为 null 时分两种：
       tried=true  → 开了二维码但图没取到（过期/满人），显示兜底文案
       tried=false → 根本没开二维码，微信号当主入口（大号显示）
     结构自上而下：署名 → 主标题 → 副标题 → 二维码 → 扫码加入 → 三个标签 → 微信号兜底 */
  function el(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    if (text) d.textContent = text;
    return d;
  }

  function buildCard(qrUrl, tried, light) {
    var card = document.createElement('div');
    card.className = 'ct-card';
    if (light) card.classList.add('ct-light');
    if (!qrUrl && !tried) card.classList.add('ct-norq');

    card.appendChild(el('ct-brand', CFG.brand));
    card.appendChild(el('ct-t', (tried && !qrUrl) ? CFG.fallbackTitle : CFG.qrTitle));
    card.appendChild(el('ct-sub', CFG.sub));

    if (qrUrl) {
      var img = document.createElement('img');
      img.className = 'ct-qr';
      img.src = qrUrl + '?t=' + TS();
      img.alt = '26 级新生交流站 · 微信群二维码';
      card.appendChild(img);
      card.appendChild(el('ct-scan', CFG.scanTip));
    }

    var tags = el('ct-tags');
    for (var i = 0; i < CFG.tags.length; i++) tags.appendChild(el('ct-tag', CFG.tags[i]));
    card.appendChild(tags);

    /* 微信号：没码 / 图失效时它是主入口，放大成按钮样式 */
    var wx = el('ct-wx');
    if (!qrUrl && !tried) {
      var id = document.createElement('span');
      id.className = 'ct-wx-id';
      id.textContent = CFG.wx;
      var tip = document.createElement('span');
      tip.className = 'ct-wx-t';
      tip.textContent = CFG.wxTip;
      wx.appendChild(id);
      wx.appendChild(tip);
    } else {
      wx.textContent = CFG.wx + ' · ' + CFG.wxTip;
    }
    wx.addEventListener('click', function () {
      var old = wx.innerHTML;
      /* 埋点：他点了微信号那一行（真实的「我要联系」动作）。
         只记「点了」这一个事实，不记任何内容 —— 上报的 key 是 ct.wechat。 */
      if (window.cjlt) window.cjlt('contact_click', { target: 'wechat' });
      copy(CFG.wx, function () {
        wx.textContent = '微信号已复制，去微信搜索添加即可 ✓';
        setTimeout(function () { wx.innerHTML = old; }, 2200);
      }, function () {
        /* 复制失败时别沉默：把号码原样摆出来让他选中，比"复制过了"却粘不出来强得多 */
        wx.textContent = '没复制成功，请手动记下：' + CFG.wx;
        setTimeout(function () { wx.innerHTML = old; }, 3600);
      });
    });
    card.appendChild(wx);
    card.appendChild(el('ct-wx-note', CFG.wxNote));

    /* 群规：默认收起，点开才看到（放卡片底部，不抢二维码的注意力） */
    if (CFG.rules && CFG.rules.length) {
      var det = document.createElement('details');
      det.className = 'ct-rules';
      var sum = document.createElement('summary');
      sum.textContent = CFG.rulesTitle;
      det.appendChild(sum);
      var rBody = el('ct-rules-body');
      for (var k = 0; k < CFG.rules.length; k++) rBody.appendChild(el('ct-rules-li', CFG.rules[k]));
      rBody.appendChild(el('ct-rules-note', CFG.rulesNote));
      det.appendChild(rBody);
      card.appendChild(det);
    }

    return card;
  }

  var CSS = '' +
    /* 只有一层样式：全部走 theme.css 变量，白天/夜间自动切换。
       历史上的「深色硬编码 + .ct-light 补丁」两层已并入这里（2026-09-18 收口）。
       唯一硬编码 = 二维码白底 #FFFFFF：扫码需要白色静默区，与主题无关。 */
    '.ct-card{max-width:420px;margin:0 auto;text-align:center}' +
    '.ct-brand{font-size:var(--fs-2xs);color:var(--sub);letter-spacing:.6px}' +
    '.ct-t{font-size:var(--fs-xl);font-weight:800;color:var(--text);letter-spacing:.5px;margin-top:var(--gap-xs)}' +
    '.ct-sub{font-size:var(--fs-sm);color:var(--sub2);line-height:var(--lh);margin-top:var(--gap-sm)}' +
    /* 二维码：白底 + 圆角 + 轻阴影，卡片里最大的元素；按原图比例缩放，不写死宽高，避免竖图被压扁 */
    '.ct-qr{width:auto;height:auto;max-width:176px;max-height:300px;background:#FFFFFF;padding:var(--gap);' +
    'border-radius:var(--r-md);margin:15px auto 0;display:block;box-shadow:0 8px 24px rgba(var(--shadow-rgb),.16)}' +
    '.ct-scan{margin-top:var(--gap-md);font-size:var(--fs-sm);font-weight:700;color:var(--accent);letter-spacing:.5px}' +
    '.ct-tags{display:flex;flex-wrap:wrap;gap:var(--gap);justify-content:center;margin-top:var(--gap-lg)}' +
    '.ct-tag{font-size:var(--fs-2xs);color:var(--accent);border:1px solid var(--brand-line);' +
    'border-radius:999px;padding:var(--gap-2xs) var(--gap-md);line-height:var(--lh)}' +
    '.ct-wx{margin-top:var(--gap-lg);font-size:var(--fs-xs);color:var(--sub2);cursor:pointer;line-height:var(--lh)}' +
    '.ct-wx-note{margin-top:var(--gap-xs);font-size:var(--fs-2xs);color:var(--sub);line-height:var(--lh)}' +
    /* 无码 / 图失效：微信号是主入口，做成按钮 */
    '.ct-card.ct-norq .ct-wx{display:inline-block;margin-top:var(--gap-xl);padding:var(--gap-md) var(--gap-3xl);font-size:var(--fs-xs);' +
    'color:var(--accent);border:1px solid var(--brand-line);border-radius:var(--r-md);background:var(--brand-soft)}' +
    '.ct-wx-id{display:block;font-size:var(--fs-xl);font-weight:800;letter-spacing:2px;color:var(--text)}' +
    '.ct-wx-t{display:block;font-size:var(--fs-xs);opacity:.75;margin-top:var(--gap-xs)}' +
    /* 群规折叠：字小、退到卡片底部 */
    '.ct-rules{margin-top:var(--gap-lg);max-width:330px;margin-left:auto;margin-right:auto}' +
    '.ct-rules summary{cursor:pointer;list-style:none;font-size:var(--fs-2xs);color:var(--sub);' +
    'text-align:center;line-height:var(--lh);padding:var(--gap-2xs) 0}' +
    '.ct-rules summary::-webkit-details-marker{display:none}' +
    '.ct-rules summary::after{content:" \\25BE"}' +
    '.ct-rules[open] summary::after{content:" \\25B4"}' +
    '.ct-rules-body{margin-top:var(--gap);padding:var(--gap-md) var(--gap-lg);border:1px solid var(--line2);' +
    'border-radius:var(--r-md);text-align:left;background:var(--card2)}' +
    '.ct-rules-li{font-size:var(--fs-xs);color:var(--sub2);line-height:var(--lh-loose)}' +
    '.ct-rules-note{margin-top:var(--gap-sm);font-size:var(--fs-2xs);color:var(--sub);line-height:var(--lh-loose)}' +
    '@media(max-width:640px){.ct-t{font-size:var(--fs-xl)}.ct-qr{max-width:164px}}';

  function injectStyle() {
    if (document.getElementById('ct-style')) return;
    var st = document.createElement('style');
    st.id = 'ct-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* 卡片落进浅色区块（首页 .ans）或所在容器是浅底 → 走浅色主题 */
  function needLight(anchor) {
    if (anchor.closest && anchor.closest('.ans')) return true;
    return isLightBg(anchor.parentElement || anchor);
  }

  function mount() {
    /* 首页是 .ask-group 里的 .wx，其余页是 .cta-card 里的 .cta-wx */
    var anchor = document.querySelector('.cta-wx') || document.querySelector('.wx');
    if (!anchor || !anchor.parentNode) return;

    /* 开源演示版：没配群码图、也没配微信号 → 换成占位说明卡，绝不渲染联系方式 */
    if (!CFG.wx && !CFG.files.length) {
      injectStyle();
      var ph = document.createElement('div');
      ph.className = 'ct-card';
      ph.innerHTML =
        '<div class="ct-brand">联系入口（占位）</div>' +
        '<div class="ct-t">这里在原站是进群二维码</div>' +
        '<div class="ct-sub">开源演示版不包含真实的群码与微信号。在 config.js 里配置 wx 或 qrFile 后，这里会自动变成真正的联系方式卡。</div>';
      anchor.parentNode.replaceChild(ph, anchor);
      return;
    }

    var light = needLight(anchor);
    injectStyle();
    /* 切白天/黑夜后重新判断一次底色，保证卡片文字始终压在正确的底色上 */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        /* ⚠️ 必须重新在文档里取 .ct-card：下面 findQR 成功后会用 replaceChild 把 anchor 换掉，
           anchor 随即脱离 DOM，再拿它算底色必然算错 —— 之前切到白天模式后二维码卡不会重算，
           淡蓝字落在白底上看不清就是这个原因（2026-09-16 修）。 */
        var c = document.querySelector('.ct-card');
        if (!c) return;
        var ok = (c.closest && c.closest('.ans')) ? true : isLightBg(c.parentElement || c);
        c.classList.toggle('ct-light', ok);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    if (CFG.showQR) {
      findQR(function (url) {
        anchor.parentNode.replaceChild(buildCard(url, true, light), anchor);
      });
    } else {
      anchor.parentNode.replaceChild(buildCard(null, false, light), anchor);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else { mount(); }
})();
