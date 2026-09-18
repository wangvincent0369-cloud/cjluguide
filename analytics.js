/* ============================================================
   analytics.js —— 最小化匿名行为记录（全站共用的唯一出口）
   ------------------------------------------------------------
   为什么这么写（2026-09-17 站长任务，改写本文件前先读这段）：

   1) 接收端 = **项目已有的 abacus 计数服务**（campus.html 从早就一直在用，
      不是我新引入的平台）。它只有一个能力：把某个 key 的计数 +1、还能读回来。
      接口：GET <统计端点>/<项目名>/<key>（原站用 abacus 计数服务；
      开源版端点用占位符，真身只存在于维护者自己的 config.js）
      ⚠️ 它的 key 只接受 ^[A-Za-z0-9_\-.]{3,64}$ —— 中文、空格一律返回 400。
         所以中文名（分类名、社团名）要先编码，见下面 P.enc。

   2) ⚠️ **abacus 没有「列出所有 key」的接口**（未知路由一律回落到它官网首页）。
      这条限制决定了能记什么：
        ✅ 能读回来：key 是**固定的有限集合**（12 个页面 / 11 个分类 / 87 个社团 /
           联系入口）—— 查看器 `_stats.js` 能按名单逐个去读。
        ❌ 读不回来：**搜索词**。新生搜什么是任意中文，我们无法预先生成名单，
           没有列表接口就永远读不回。所以本文件对搜索**只上报总次数**
           （sr.total / sn.total），**不上报具体词**（上报了也读不出来，
           反而等于把学生的搜索词白送给第三方）。
           要拿到具体词，得换一个能列数据的接收端 —— 见任务报告的「选项 B」。

   3) 隐私红线（只记匿名行为，绝不记能定位到人的东西）：
        · 不记微信号 / 手机号 / 姓名 / IP / 精确位置 / 设备标识 / 聊天内容
        · 不用 cookie、不生成用户 ID、不存 localStorage —— 同一个人的两次访问
          无法被关联起来（abacus 侧只留下一个匿名数字）
        · 搜索词如果长得像学号 / 手机号（连续 6 位以上数字、含 @）一律不上报
        · 只记文件名级的页面，不记完整 URL、不记来源页、不记 UTM

   4) 容错：file:// 双击打开、断网、abacus 挂了 —— 全部静默失败，
      绝不影响页面原有功能（每个出口都包了 try/catch，fetch 也带 .catch）。
      所以本文件**不返回任何值、不阻塞任何交互**。

   5) 事件与 key 的对应（查看器 _stats.js 按这张表去读）：
        page_view      → pv.<页面名>              例 pv.club
        category_click → cat.all / cat.<分类名>    例 cat.<编码后的「学术科技」>
        club_click     → clu.<社团名>
        contact_click  → ct.wechat / ct.ask
        search         → sr.total（每次搜索）/ sn.total（其中搜不到结果的）
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     第一部分：纯函数（不碰 DOM）—— Node 里也能 require，
     这样查看器 _stats.js 和本文件共用同一套编解码，永远不会走偏。
     ============================================================ */
  var P = {
    /* 中文 → abacus 允许的 ASCII key。
       规则：字母数字原样保留，其余字符写成「_ + 码位(36 进制，**定长 5 位**)」。
       ⚠️ 定长是必须的：一开始写成不定长，结果后面的普通字母会被当成 36 进制的一部分
          一起吃进去 —— 「a_b」解成「a൧」、「STAR·T街舞协会」解成「STAR᧙街舞协会」。
          36^5 = 6046 万 > Unicode 上限 111 万，5 位一定装得下（2026-09-17 修）。
       例：「数学建模」→ _00k1c_00i1y_00ire_00kyp，可逆。 */
    enc: function (s) {
      s = String(s == null ? '' : s);
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i), c = s.charCodeAt(i);
        if (/^[A-Za-z0-9]$/.test(ch)) { out += ch; continue; }
        /* 代理对（emoji 等）要合成一个码位，否则前后半个字符分别编码会解不出来 */
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
          var c2 = s.charCodeAt(i + 1);
          if (c2 >= 0xDC00 && c2 <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++; }
        }
        var b = c.toString(36);
        out += '_' + '00000'.slice(b.length) + b;
      }
      return out;
    },
    dec: function (k) {
      k = String(k == null ? '' : k);
      var out = '';
      for (var i = 0; i < k.length; i++) {
        if (k.charAt(i) !== '_') { out += k.charAt(i); continue; }
        var code = parseInt(k.substr(i + 1, 5), 36);   /* 定长 5 位，不需要找分隔符 */
        if (!isNaN(code)) {
          try {
            out += String.fromCodePoint ? String.fromCodePoint(code) : String.fromCharCode(code);
          } catch (e) { out += '?'; }
        }
        i += 5;
      }
      return out;
    },
    /* 拼一个合法的 abacus key：太长就削源串，保证最终长度 ≤ 64（服务端硬限制） */
    key: function (prefix, name) {
      var s = String(name == null ? '' : name).trim();
      var k = prefix + P.enc(s);
      while (k.length > 64 && s.length > 1) { s = s.slice(0, -1); k = prefix + P.enc(s); }
      return k.slice(0, 64);
    },
    /* 页面名：只取文件名（不含路径、不含参数），file:// 下也一样。
       index.html → index。文件名本身是 ASCII，enc 只是保险。 */
    page: function (href) {
      var p = '';
      try {
        var u = String(href || '');
        p = u.split('#')[0].split('?')[0].split('/').pop() || '';
      } catch (e) {}
      if (!p) p = 'index.html';
      p = p.replace(/\.html?$/i, '') || 'index';
      return P.enc(p) || 'index';
    }
  };

  /* Node（查看器 / 自检脚本）走这条：只导出纯函数，绝不碰 DOM */
  if (typeof module !== 'undefined' && module.exports) { module.exports = P; return; }

  /* ============================================================
     第二部分：只有浏览器才会走到的部分
     ============================================================ */

  var STATS = (window.SITE && window.SITE.stats) || {};

  var CFG = {
    /* 总开关。开源演示版默认 false（一个请求都不发 —— 防止克隆站把
       访问数据打到维护者自己的统计端点上）。自用时在 config.js 改 true。 */
    on: STATS.on === true,
    /* 接收端。换服务只需要改这一行 —— 上面所有调用点都不用动。
       ⚠️ 换之前先确认新端点的 key 规则（本例的 abacus 只收 ASCII key）。 */
    endpoint: STATS.endpoint || '',
    /* 搜索框「输入完成」的判定：停手 2.5 秒才算一次真实搜索。
       220ms 那种是给结果面板用的，拿它上报会把每个中间状态都记一遍。 */
    idle: 2500,
    /* 搜索词隐私过滤：像学号 / 手机号的一律不报 */
    privateRe: /\d{6,}|@/
  };

  /* ---------- 只统计「真正对外发布的那个站」 ----------
     本地预览（localhost / 127.0.0.1 / 局域网 IP，比如手机连 10.5.70.231:8123）不计 ——
     否则站长自己一遍遍刷新排排版，数字就全是他自己的，看不出新生的真实行为。
     ⚠️ file:// 打开（离线包 guides-all.zip 解压后双击）**照常计**，那是真实读者。 */
  var REAL = null;
  function realSite() {
    if (REAL !== null) return REAL;
    REAL = (function () {
      var h = '';
      try { h = location.hostname || ''; } catch (e) { return false; }
      if (!h) return true;                                        /* file:// → 离线包 */
      if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return false;
      if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
      return true;
    })();
    return REAL;
  }

  /* ---------- 唯一出口 ---------- */
  /* 兜底通道：某些环境（file:// 打开）里 fetch 会被浏览器直接拒掉，用一张
     1 像素图片去发同样的请求 —— 请求照发，图不存在也没关系，静默失败。
     ⚠️ 必须带随机参数：不然同一张图会被浏览器缓存走，请求发不出去、计数就丢了。 */
  function viaImage(url) {
    try { new Image().src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Math.random().toString(36).slice(2); } catch (e) {}
  }

  function send(key) {
    if (!CFG.on || !key || !realSite()) return;
    var url = CFG.endpoint + key;
    /* 用 GET（实测 /hit 走 GET 才稳）。fire-and-forget：不读响应、不排队、不重试，
       失败就算了 —— 统计永远不能影响新生看资料。 */
    try {
      if (window.fetch) {
        var pr = fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true });
        if (pr && pr['catch']) { pr['catch'](function () { viaImage(url); }); return; }
      }
    } catch (e) {}
    viaImage(url);
  }

  function pageName() { return P.page(location.href); }

  /* ---------- 事件 → key ---------- */
  function track(event, data) {
    data = data || {};
    var key = '';
    switch (event) {
      case 'page_view':
        key = 'pv.' + (data.page || pageName());
        break;
      case 'category_click':
        /* 「全部」也是分类点击的一种，单独一个 key（任务点名要求记） */
        key = (data.category === '全部') ? 'cat.all' : P.key('cat.', data.category);
        break;
      case 'club_click':
        key = P.key('clu.', data.club);
        break;
      case 'contact_click':
        key = 'ct.' + (data.target || 'other');
        break;
      case 'search':
        /* ⚠️ 刻意不带搜索词 —— abacus 读不回任意 key，带了也白带。
           词只在本地用来判「有没有结果」，见下面 search()。 */
        send('sr.total');
        if (data.none) send('sn.total');
        return;
      default:
        return;                                   /* 未知事件直接丢弃，不猜 */
    }
    send(key);
  }

  /* ---------- 搜索事件（去重 / 隐私过滤 / 无结果判定都在这儿） ---------- */
  var lastWord = '', lastAt = 0;
  function search(word, container, src) {
    var w = String(word == null ? '' : word).trim();
    if (w.length < 2) return;                     /* 一个字的多半是打字中间态 */
    if (w === lastWord) return;                   /* 同一个词只记一次 */
    if (CFG.privateRe.test(w)) { lastWord = w; return; }   /* 像学号/手机号 → 不报 */
    /* 上一条是这条的前缀（「数学」→「数学建模」）＝ 同一次输入的继续：
       两条都放行，保证「更完整的那个词」一定被记上；间隔太久的才算两次搜索 */
    lastWord = w; lastAt = Date.now();
    var none = false;
    try { none = !!(container && container.querySelector && container.querySelector('.ss-none')); } catch (e) {}
    track('search', { keyword: w, none: none, src: src || 'typed' });
  }

  /* ---------- 给一个搜索框挂「停手后上报」 ----------
     只加监听，不改搜索本身的行为（结果面板照旧由 search.js 自己渲染）。 */
  function watchSearch(input, getContainer) {
    if (!input || input._cjlWatched) return;
    input._cjlWatched = true;
    var t = null;
    function fire() {
      var box = null;
      try { box = getContainer ? getContainer() : null; } catch (e) {}
      search(input.value, box, 'typed');
    }
    function later() { if (t) clearTimeout(t); t = setTimeout(fire, CFG.idle); }
    input.addEventListener('keyup', later);
    input.addEventListener('change', later);
    /* 中文输入法：候选上屏那一刻就重置计时，避免把拼音当搜索词 */
    input.addEventListener('compositionend', later);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.keyCode === 13) { if (t) clearTimeout(t); fire(); }
    });
  }

  /* ---------- 对外 ---------- */
  track.page = pageName;
  track.search = search;
  track.watchSearch = watchSearch;
  track.P = P;                                    /* 调试用 */
  window.cjlt = track;

  /* ---------- 页面访问：每个页面一次 ---------- */
  function init() { try { track('page_view'); } catch (e) {} }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (e) {}
})();
