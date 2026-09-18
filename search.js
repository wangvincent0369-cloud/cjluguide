/* ============================================================
   全站搜索 search.js —— 纯前端，静态站专用
   （index.html / campus.html = 顶部大搜索框，其余页 = 右下角 🔍 悬浮球）
   ------------------------------------------------------------
   用法：
   - 每个 HTML 的 </body> 前引入本文件：
       <script src="search.js"></script>
   - 首页会自动在标题下方出现搜索框；其他页右下角出现 🔍 悬浮按钮。
   - 索引 = 首次搜索时 fetch 各页面源码自动抽取，不需要手动维护数据。
   - 以后给页面新增社团 / 专业 / 小节标题 / 行李条目等，搜索会自动收录，
     除非页面结构大改（那时才需要同步改本文件的解析器）。
   唯一手动维护的：下面 PAGES 里的页面简介（10 条）。
   离线（file://）打开时 fetch 会被浏览器拦截：退化为只搜当前打开这一页。
   ============================================================ */
(function () {
  'use strict';

  /* 页面级元数据：只有这一份，别到处复制 */
  var PAGES = [
    { u: 'index.html', t: '新生指南总览', k: '首页 目录', d: '直接搜答案；当下提醒（招新 / 报名截止）；学业、校园规则、校园资源入口' },
    { u: 'questions.html', t: '新生问题汇总', k: '新生问题 报到 宿舍 军训 校园卡 防骗', d: '报到前、报到周新生最常问的问题与答案，含防骗提醒' },
    { u: 'welfare.html', t: '新生福利', k: '福利 学生票 12306 豆包 夸克 会员', d: '12306 学生票、豆包 3 个月、夸克网盘+扫描王 3 个月的领取步骤与截止时间' },
    { u: 'luggage.html', t: '新生行李清单', k: '行李 开学准备', d: '必带证件、线上买、线下买三组；精简 32 / 全面 47 / 超级 120 三档切换，可勾选记进度' },
    { u: 'timeline.html', t: 'CJLU 新生入学完全时间线', k: '时间线 报到 军训 选课 考试', d: '从录取通知书到第一个寒假：报到流程、宿舍、食堂、绩点、体测、冬训等，含完整校历和校园地图' },
    { u: 'course.html', t: '选课指南', k: '选课 课程', d: '课程类型、必修与选修、历年课单、选课时间、FAQ' },
    { u: 'curriculum.html', t: '培养方案查询', k: '培养方案 学分 核心课', d: '57 个专业的培养方案：总学分、学位类型、核心课程、每学期课表' },
    { u: 'major.html', t: '专业解读（五维评价）', k: '专业 就业 考研 难度', d: '58 个专业的就业、考研、难度、师资、潜力五维评价' },
    { u: 'transfer.html', t: '转专业指南', k: '转专业 名额', d: '申请条件、流程时间、系统操作、2025 级 393 / 2024 级 359 两批名额、学长经验' },
    /* ⚠️ 09-17 修：这里原写「87 个社团按 11 大类整理，附各自简介」——
       社团页 09-16 就重建成 10 类 + 标签体系了，搜索结果显示的还是旧口径（11 大类、只有简介）。 */
    { u: 'club.html', t: '社团分类汇总', k: '社团', d: '87 个社团按 10 大类整理，每个社团带 2~4 个标签' }
  ];

  /* ---------- 小工具 ---------- */
  var PUNCT_RE = /[，。？！；：、,.!?;:'"“”‘’（）()【】\[\]《》〈〉<>\/\\|_@#￥$%^&*+=~`·-]/g;
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    s = s.replace(/[\s\u3000]+/g, '');   /* 忽略空格（含全角） */
    s = s.replace(PUNCT_RE, '');
    return s;
  }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function cut(s, n) { s = clean(s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function stripScripts(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' '); }
  function toDom(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }
  function textNo(container, sel) {
    var cl = container.cloneNode(true);
    var rm = sel ? cl.querySelector(sel) : null;
    if (rm) rm.remove();
    return clean(cl.textContent);
  }

  /* ---------- 索引条目 ---------- */
  var IDX = [];
  var IDX_OK = false;
  var IDX_FAIL = false;
  var IDX_PROMISE = null;

  function mk(u, t, k, d) {
    var titleN = norm(t);
    var hay = norm([t, k, d].join(' '));
    return { u: u, t: clean(t), k: k || '', d: cut(d || '', 90),
             tN: titleN, kN: norm(k), h: hay };
  }

  function pushUnique(arr, e) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].u === e.u && arr[i].tN === e.tN) return;
    }
    arr.push(e);
  }

  /* ---------- 各页解析器（新增页面的资料若想被搜到，在这里加解析规则） ---------- */

  /* 社团：.category-card 分组 → .club-item（名称 + 简介） */
  function parseClub(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var cards = doc.querySelectorAll('.category-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var catEl = card.querySelector('.card-header .title');
      var cat = catEl ? clean(catEl.textContent) : '';
      var items = card.querySelectorAll('.club-item');
      for (var j = 0; j < items.length; j++) {
        var n = items[j].querySelector('.name');
        var inf = items[j].querySelector('.info');
        if (!n) continue;
        /* ⚠️ 09-17：带上条目锚点（club-1 … club-87），点搜索结果直接落到那个社团，
           不再落在页面顶部。id 直接取 HTML 上的（见 club.html 的 .club-item）。 */
        var cid = items[j].getAttribute('id') || '';
        pushUnique(out, mk('club.html' + (cid ? '#' + cid : ''), clean(n.textContent), cat ? '社团 · ' + cat : '社团',
          inf ? clean(inf.textContent) : ''));
      }
    }
    return out;
  }

  /* 时间线：.stage 内 .card，标题 h3（含 id），简介=卡片正文 */
  function parseTimeline(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var cards = doc.querySelectorAll('.stage .card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var h = card.querySelector('h3');
      if (!h) continue;
      var badge = h.querySelector('.badge');
      var t = clean(h.textContent.replace(badge ? badge.textContent : '', '').replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, ''));
      var id = h.getAttribute('id') || '';
      var k = badge ? '时间线 · ' + clean(badge.textContent) : '时间线';
      pushUnique(out, mk('timeline.html' + (id ? '#' + id : ''), t, k, textNo(card, 'h3')));
    }
    return out;
  }

  /* 选课：.section（章节标题 h2.section-title）+ .type-card(h4) + .card(h3) */
  function parseCourse(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var secs = doc.querySelectorAll('.section');
    for (var i = 0; i < secs.length; i++) {
      var st = secs[i].querySelector('.section-title');
      if (!st) continue;
      var id = secs[i].getAttribute('id') || '';
      pushUnique(out, mk('course.html' + (id ? '#' + id : ''), clean(st.textContent), '选课指南 · 章节',
        textNo(secs[i], '.section-title')));
    }
    var tcs = doc.querySelectorAll('.type-card');
    for (var j = 0; j < tcs.length; j++) {
      var h4 = tcs[j].querySelector('h4');
      if (!h4) continue;
      pushUnique(out, mk('course.html', clean(h4.textContent), '选课指南 · 课程类型', textNo(tcs[j], 'h4')));
    }
    var cards = doc.querySelectorAll('.section .card');
    for (var m = 0; m < cards.length; m++) {
      var h3 = cards[m].querySelector('h3');
      if (!h3) continue;
      pushUnique(out, mk('course.html', clean(h3.textContent), '选课指南', textNo(cards[m], 'h3')));
    }
    return out;
  }

  /* 转专业：.section 正文章节 + 名额表每一行（专业/学院/名额/难度） */
  function parseTransfer(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var secs = doc.querySelectorAll('.section');
    for (var i = 0; i < secs.length; i++) {
      var st = secs[i].querySelector('.section-title');
      if (!st) continue;
      var id = secs[i].getAttribute('id') || '';
      pushUnique(out, mk('transfer.html' + (id ? '#' + id : ''), clean(st.textContent), '转专业指南 · 章节',
        textNo(secs[i], '.section-title')));
    }
    var rows = doc.querySelectorAll('#quota-2025 tr, #quota-2024 tr');
    for (var j = 0; j < rows.length; j++) {
      var td = rows[j].querySelectorAll('td');
      if (td.length < 4) continue;
      var name = clean(td[0].textContent);
      var college = clean(td[1].textContent);
      var num = clean(td[2].textContent);
      var diff = clean(td[3].textContent);
      if (!name) continue;
      pushUnique(out, mk('transfer.html', name, diff ? '转专业名额 · ' + diff : '转专业名额',
        '学院：' + college + ' · 名额：' + num));
    }
    return out;
  }

  /* 培养方案：script 里的压缩 JSON，逐个专业取名 + 学院（名字来自 {"name": ） */
  function parseCurriculum(raw) {
    var out = [];
    var re = /\{"name":\s*"([^"]+)",\s*"college":\s*"([^"]+)"/g;
    var m;
    while ((m = re.exec(raw)) !== null) {
      /* ⚠️ 09-17：锚点用**专业名**派生（curriculum-<专业名>），不用序号 ——
         这两页是 filter+map 渲染的，筛选一次序号就全变了，序号做锚点必然指错。 */
      pushUnique(out, mk('curriculum.html#curriculum-' + m[1], m[1], '培养方案 · ' + (m[2] || ''), '学院：' + (m[2] || '') + ' · 总学分/核心课/每学期课表可查'));
    }
    return out;
  }

  /* 专业解读：script 数组 name: + college:（按顺序配对） */
  function parseMajor(raw) {
    var out = [];
    var names = [], colleges = [], m, re1 = /name\s*:\s*"([^"]+)"/g;
    while ((m = re1.exec(raw)) !== null) names.push(m[1]);
    var re2 = /college\s*:\s*"([^"]+)"/g;
    while ((m = re2.exec(raw)) !== null) colleges.push(m[1]);
    for (var i = 0; i < names.length; i++) {
      var col = colleges[i] || '';
      /* ⚠️ 09-17：锚点同样用专业名派生（major-<专业名>），不用序号（页面是 filter+map 渲染） */
      pushUnique(out, mk('major.html#major-' + names[i], names[i], '专业解读', '学院：' + col + ' · 就业/考研/难度/师资/潜力评价'));
    }
    return out;
  }

  /* 行李：.section 分组 → label.item（名/说明），data-full=仅全面版 */
  function parseLuggage(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var secs = doc.querySelectorAll('.section');
    for (var i = 0; i < secs.length; i++) {
      var h2 = secs[i].querySelector('.section-head h2, h2');
      var gid = (h2 && h2.getAttribute('id')) || '';
      var gName = h2 ? clean(h2.textContent) : '';
      var sub = secs[i].querySelector('.section-sub');
      if (h2) {
        pushUnique(out, mk('luggage.html' + (gid ? '#' + gid : ''), gName, '行李清单 · 分组',
          sub ? clean(sub.textContent) : ''));
      }
      var items = secs[i].querySelectorAll('label.item');
      for (var j = 0; j < items.length; j++) {
        var txt = items[j].querySelector('.txt');
        if (!txt) continue;
        var nameNode = null;
        for (var c = 0; c < txt.childNodes.length; c++) {
          if (txt.childNodes[c].nodeType === 3 && clean(txt.childNodes[c].nodeValue)) {
            nameNode = clean(txt.childNodes[c].nodeValue);
            break;
          }
        }
        if (!nameNode) nameNode = clean(txt.textContent);
        var desc = txt.querySelector('.desc');
        var full = items[j].hasAttribute('data-full');
        var k = (gName ? gName : '行李清单') + (full ? ' · 全面版' : ' · 精简版');
        pushUnique(out, mk('luggage.html' + (gid ? '#' + gid : ''), nameNode, k,
          desc ? clean(desc.textContent) : ''));
      }
    }
    return out;
  }

  /* 新生问题汇总：.qa-item（问题 .q / summary，答案 .a） */
  function parseQuestions(raw) {
    var out = [], doc = toDom(stripScripts(raw));
    var items = doc.querySelectorAll('.qa-item');
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var qEl = it.querySelector('.q') || it.querySelector('summary');
      if (!qEl) continue;
      var aEl = it.querySelector('.a');
      /* ⚠️ 09-17：这里以前写死 'questions.html'（不带锚点）→ 搜到某一条问答、点进去
         只会落在页面最顶上，还得自己翻。questions.html 的每条 .qa-item 现在都有 id
         （qa-1 … qa-40 + 原本就有的 #xuanke），所以这里带上。 */
      var qid = it.getAttribute('id') || '';
      pushUnique(out, mk('questions.html' + (qid ? '#' + qid : ''), clean(qEl.textContent), '新生问题汇总',
        aEl ? clean(aEl.textContent) : ''));
    }
    return out;
  }

  var PARSERS = {
    'club.html': parseClub,
    'timeline.html': parseTimeline,
    'course.html': parseCourse,
    'transfer.html': parseTransfer,
    'luggage.html': parseLuggage,
    'questions.html': parseQuestions
  };

  function parseDataPage(file, raw) {
    if (file === 'curriculum.html') return parseCurriculum(raw);
    if (file === 'major.html') return parseMajor(raw);
    return [];
  }

  /* ---------- 建索引（只建一次；失败则标记，等下次再试） ---------- */
  function buildIndex() {
    var list = [];
    for (var p = 0; p < PAGES.length; p++) pushUnique(list, mk(PAGES[p].u, PAGES[p].t, PAGES[p].k, PAGES[p].d));

    var domFiles = ['club.html', 'timeline.html', 'course.html', 'transfer.html', 'luggage.html', 'questions.html'];
    var dataFiles = ['curriculum.html', 'major.html'];

    var jobs = domFiles.map(function (f) {
      return fetch(f, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(f);
        return r.text();
      }).then(function (txt) {
        try { return PARSERS[f](txt); } catch (e) { return []; }
      }).catch(function () { return []; });
    });
    var dataJobs = dataFiles.map(function (f) {
      return fetch(f, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(f);
        return r.text();
      }).then(function (txt) {
        try { return parseDataPage(f, txt); } catch (e) { return []; }
      }).catch(function () { return []; });
    });

    return Promise.all(jobs.concat(dataJobs)).then(function (groups) {
      var all = list.slice();
      for (var i = 0; i < groups.length; i++) {
        for (var j = 0; j < groups[i].length; j++) pushUnique(all, groups[i][j]);
      }
      return all;
    }).then(function (all) {
      IDX = all;
      IDX_OK = true;
      return all;
    }).catch(function () {
      IDX_FAIL = true;   /* 网络/离线失败，走"只搜当前页"兜底 */
      return buildLocalOnly();
    });
  }

  /* 离线兜底：只用当前打开的这一页建立最小索引 */
  function buildLocalOnly() {
    var file = currentFile();
    var list = [];
    for (var p = 0; p < PAGES.length; p++) {
      if (PAGES[p].u === file) pushUnique(list, mk(PAGES[p].u, PAGES[p].t, PAGES[p].k, PAGES[p].d));
    }
    try {
      var raw = document.documentElement.outerHTML;
      if (PARSERS[file]) {
        var arr = PARSERS[file](raw);
        for (var i = 0; i < arr.length; i++) pushUnique(list, arr[i]);
      } else if (file === 'curriculum.html' || file === 'major.html') {
        var arr2 = parseDataPage(file, raw);
        for (var j = 0; j < arr2.length; j++) pushUnique(list, arr2[j]);
      }
    } catch (e) { /* 忽略 */ }
    IDX = list;
    IDX_OK = true;
    IDX_FAIL = false;   /* 离线兜底已成功，撤销失败标记 */
    return list;
  }

  function ensureIndex() {
    if (!IDX_PROMISE) {
      if (location.protocol === 'file:') IDX_PROMISE = buildLocalOnly();
      else IDX_PROMISE = buildIndex();
    }
    return IDX_PROMISE;
  }

  function currentFile() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p === '' ? 'index.html' : p;
  }
  function isHome() {
    /* 只有打了标记的页面才是首页：index=home、campus=campus。
       其余页面（包括没打标记的所有页）一律走右下角悬浮球。
       ⛔ 不许退回「按网址文件名猜」的旧判断——IDE 内置预览给的网址不带页面名，
          空路径会被兜底成 index，把首页大搜索框错塞进别的页面（09-18 两次踩坑）。 */
    var m = document.body ? document.body.getAttribute('data-page') : null;
    return m === 'home' || m === 'campus';
  }

  /* ---------- 搜索逻辑：多关键词 AND + 中文双字模糊 ---------- */
  function normTerms(q) {
    var parts = String(q || '').split(/[\s\u3000]+/);
    var out = [], i;
    for (i = 0; i < parts.length; i++) {
      var n = norm(parts[i]);
      if (n) out.push(n);
    }
    return out;
  }

  function termScore(e, t, fuzzyOK) {
    if (e.tN.indexOf(t) >= 0) return 30;                 /* 标题完全命中 */
    if (e.h.indexOf(t) >= 0) {                           /* 全文命中 */
      var b = 12;
      if (e.kN && e.kN.indexOf(t) >= 0) b += 5;          /* 分类命中加权 */
      return b;
    }
    /* 长词：按连续两字滑窗模糊匹配。⚠️ 只在前面的精确匹配不够用时才允许（见 runSearch）
       ⚠️ 而且**至少有一个窗口要落在标题 / 分类里** —— 只命中正文的一律不算。
       为什么（09-17 实测）：搜「快递站」时，「指甲剪 + 剪刀」那条正文里顺带提过一次快递，
       旧规则就把它放进了结果前几条，正是站长说的「虽然有那个词，但大家不需要」。
       加了这道闸之后：标题是「快递 & 超市」「快递地址怎么写」的照样进得来 ✓，
       只在正文里提过一句的全部挡掉 ✓。 */
    if (fuzzyOK && t.length > 2) {
      var hit = 0, tot = 0, i, onTitle = false;
      for (i = 0; i + 2 <= t.length; i++) {
        tot++;
        var g = t.substr(i, 2);
        if (e.h.indexOf(g) >= 0) {
          hit++;
          if (e.tN.indexOf(g) >= 0 || (e.kN && e.kN.indexOf(g) >= 0)) onTitle = true;
        }
      }
      if (onTitle && tot && hit / tot >= 0.3) return 2 + (hit / tot) * 10;
    }
    return 0;
  }

  function collect(terms, fuzzyOK) {
    var out = [];
    for (var i = 0; i < IDX.length; i++) {
      var e = IDX[i], sc = 0, ok = true, j;
      for (j = 0; j < terms.length; j++) {
        var s = termScore(e, terms[j], fuzzyOK);
        if (s <= 0) { ok = false; break; }
        sc += s;
      }
      if (ok) out.push({ e: e, sc: sc });
    }
    return out;
  }

  /* 搜索：**两遍匹配**（09-17 改）
     ⚠️ 以前只有一遍，模糊匹配和精确匹配混在一起排序 —— 长词（如「快递站」）只要
        有两个字连得上就给 6~7 分，于是「正文里顺带提过一句快递」的条目也被翻出来，
        结果就是站长说的「虽然有那个词，但大家不需要」。
     现在：先跑精确匹配（标题/正文里真的出现这个词）；**只要精确匹配有结果就直接返回**，
     一条都没有（生僻说法 / 长句 / 错别字）才用模糊匹配兜底。
     实测：门槛设成「不足 6 条就补」时，搜「快递站」精确 4 条 → 模糊又补进来一条
     「指甲剪 + 剪刀」（它正文只提过一次快递）—— 正是站长说的无关结果。
     门槛收到 0 又会把「快递 & 超市」这类真正相关的也砍掉（实测只剩 1 条）。
     最后做法：门槛保持「不足 6 条才补模糊」，但在 termScore 里加一道闸 ——
     **模糊命中必须落在标题 / 分类里**，只沾正文的不算。两处配合才是对的。 */
  function runSearch(q) {
    var terms = normTerms(q);
    if (!terms.length) return [];
    var hit = collect(terms, false);
    if (hit.length < 6) {
      var seen = {};
      hit.forEach(function (x) { seen[x.e.u + '|' + x.e.tN] = 1; });
      collect(terms, true).forEach(function (x) {
        var k = x.e.u + '|' + x.e.tN;
        if (!seen[k]) { seen[k] = 1; hit.push(x); }
      });
    }
    hit.sort(function (a, b) { return b.sc - a.sc; });
    var out = [];
    for (var k = 0; k < hit.length && k < 20; k++) out.push(hit[k].e);
    return out;
  }

  /* ---------- 渲染 ---------- */
  function resultHTML(e) {
    return '<a class="ss-item" href="' + e.u + '">' +
      '<span class="ss-it">' + esc(e.t) + '</span>' +
      (e.k ? '<span class="ss-ik">' + esc(e.k) + '</span>' : '') +
      (e.d ? '<span class="ss-id">' + esc(e.d) + '</span>' : '') +
      '</a>';
  }

  function noResultHTML() {
    /* 无结果的两个出口（原站 09-18 定）：
       问学长   = 我希望有人答（展开站长微信号，仅当 config.js 配了 wx）
       提交需求 = 网站缺这条答案，帮站长补货（本地组装文本 → 自愿复制）
       两个面板互斥。不做表单、不做后端、不静默上报搜索词（隐私红线不变）。
       开源演示版默认 wx 为空：问学长按钮自动隐藏，全程不留联系方式。 */
    var askBtn = WX
      ? '<button type="button" class="ss-ask" data-ask="1">问学长：想有人答我</button>'
      : '';
    var wxPanel = WX
      ? '<div class="ss-wx" hidden>加微信 <b>' + WX + '</b> · 备注「渠道+新生」 · 具体问题直接问，当晚回复</div>'
      : '';
    var reqHint = WX
      ? '复制后发给微信 ' + WX + '，看到就尽快补进网站'
      : '复制这条需求，通过仓库主页的联系方式发给站长，看到就会补进网站';
    return '<div class="ss-none">' +
      '<div class="ss-none-t">这个问题我还没整理到</div>' +
      '<div class="ss-none-hint">换个说法试试（比如「宿舍限电多少」）；真没有的话，选一个：</div>' +
      '<div class="ss-acts">' + askBtn +
      '<button type="button" class="ss-submit" data-submit="1">提交需求：帮网站补上</button>' +
      '</div>' + wxPanel +
      '<div class="ss-req" hidden>' +
      '<div class="ss-req-t"></div>' +
      '<button type="button" class="ss-req-btn" data-req-copy="1">复制这条需求</button>' +
      '<div class="ss-req-hint">' + reqHint + '</div>' +
      '</div>' +
      '</div>';
  }

  /* 站长微信号：读 config.js。留空 = 相关按钮/面板自动隐藏（开源演示版默认）。 */
  var WX = (window.SITE && window.SITE.wx) || '';
  var WX_RE = WX ? new RegExp(WX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  function copyText(txt, okFn, failFn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(okFn, function () { legacyCopy(txt, okFn, failFn); });
    } else { legacyCopy(txt, okFn, failFn); }
  }
  function legacyCopy(txt, okFn, failFn) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    /* execCommand 返回 false = 失败，必须让用户知道（和 contact.js / share.js 同一教训） */
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) { okFn(); } else if (failFn) { failFn(); }
  }
  function attachAsk(container) {
    if (container._askBound) return;
    container._askBound = true;
    container.addEventListener('click', function (ev) {
      /* 出口一：问学长 —— 搜不到但想找人答。埋点 = 最可行动的「需求没被满足」信号：
         搜不到的词记不下来（见 analytics.js 头注释），但「点了问学长」说明这事真的有人要。 */
      var ask = ev.target.closest('[data-ask]');
      if (ask) {
        if (window.cjlt) window.cjlt('contact_click', { target: 'ask' });
        var wx = container.querySelector('.ss-wx');
        var req = container.querySelector('.ss-req');
        if (req) req.hidden = true;                    /* 两个面板互斥 */
        if (!wx) return;
        wx.hidden = !wx.hidden;
        if (!wx.hidden && WX_RE && WX_RE.test(wx.textContent)) {
          var m = wx.textContent.match(WX_RE);
          if (m) {
            var range = document.createRange();
            range.selectNodeContents(wx);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        return;
      }
      /* 出口二：提交需求（09-18 新增）—— 站里缺这条内容，是补货信号。
         本地组装文本、用户自愿复制发给微信；不做表单、不做后端、不静默上报搜索词。 */
      var sub = ev.target.closest('[data-submit]');
      if (sub) {
        if (window.cjlt) window.cjlt('contact_click', { target: 'submit' });
        var req2 = container.querySelector('.ss-req');
        var wx2 = container.querySelector('.ss-wx');
        if (!req2) return;
        if (wx2) wx2.hidden = true;                    /* 两个面板互斥 */
        var q = container._q || '';
        var d = new Date();
        req2.querySelector('.ss-req-t').textContent =
          (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日搜了「' + q + '」，站里没找到，希望能补上这条';
        req2.hidden = false;
        return;
      }
      /* 提交需求面板里的复制按钮 */
      var cp = ev.target.closest('[data-req-copy]');
      if (cp) {
        var box = container.querySelector('.ss-req');
        var txt = box ? box.querySelector('.ss-req-t').textContent : '';
        if (!txt) return;
        copyText(txt, function () {
          cp.textContent = '已复制 ✓ 去微信粘贴发送';
          setTimeout(function () { cp.textContent = '复制这条需求'; }, 2400);
        }, function () {
          cp.textContent = '没复制成功，长按选中上面那行字';
          setTimeout(function () { cp.textContent = '复制这条需求'; }, 3200);
        });
      }
    });
  }

  function renderInto(box, q) {
    box.textContent = '';
    box._q = q;   /* 记下本次搜索词：无结果面板的「提交需求」组装文本要用 */
    if (!q) {
      var hint = document.createElement('div');
      hint.className = 'ss-tip';
      hint.textContent = IDX_OK ? '试试：宿舍 · 转专业 · 校园卡 · 军训 · 选课 · 社团 · 绩点 · 行李'
        : '正在建立索引（首次约 1 秒）…';
      box.appendChild(hint);
      return;
    }
    var res = runSearch(q);
    var frag = document.createDocumentFragment();
    if (res.length) {
      for (var i = 0; i < res.length && i < 20; i++) {
        frag.appendChild(domify(resultHTML(res[i])));
      }
    } else if (IDX_FAIL) {
      frag.appendChild(domify('<div class="ss-tip">离线预览搜不到全站：请在在线版使用全站搜索，或直接打开对应页面</div>'));
    } else {
      frag.appendChild(domify(noResultHTML()));
    }
    box.appendChild(frag);
    attachAsk(box);
  }

  function domify(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstChild;
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------- UI：样式注入、首页搜索框、子页悬浮按钮、全屏面板 ---------- */
  var CSS = '' +
    '.ss-fab{position:fixed;right:16px;bottom:26px;z-index:9990;width:52px;height:52px;border-radius:50%;' +
    'border:none;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;font-size:var(--fs-h2);' +
    'box-shadow:0 6px 18px rgba(96,165,250,.4);cursor:pointer}' +
    '.ss-fab:hover{transform:translateY(-2px)}' +
    '.ss-home{max-width:var(--w-wide);margin:0 auto;padding:0 var(--gap-2xl) var(--gap-sm)}' +
    '.ss-home-box{position:relative}' +
    /* 兜底：搜索按钮/「大家在搜」胶囊的样式原本只写在 index/campus 页面里。
       万一别的页面被误注入了这套框，至少按胶囊风正常显示，不裸奔成浏览器默认按钮。
       :not([data-page]) 保证 index/campus 自带的页面样式完全不受这里影响。 */
    'body:not([data-page]) .ss-home .ss-home-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;cursor:pointer;font-family:inherit;font-size:var(--fs-sm);font-weight:600;color:var(--on-accent);background:var(--accent);border-radius:var(--r-sm);padding:var(--gap) var(--gap-xl);min-height:40px}' +
    'body:not([data-page]) .ss-home .ss-home-btn:hover{background:var(--accent-d)}' +
    'body:not([data-page]) .ss-home .ss-home-hot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--gap-xs);margin-top:var(--gap-md)}' +
    'body:not([data-page]) .ss-home .ss-home-hot-t{font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;padding-right:var(--gap-xs)}' +
    'body:not([data-page]) .ss-home .ss-home-chip{font-family:inherit;font-size:var(--fs-xs);font-weight:500;cursor:pointer;line-height:1;color:var(--text2);background:var(--card);border:1px solid var(--line2);border-radius:var(--r-pill);padding:var(--gap-sm) var(--gap-lg)}' +
    'body:not([data-page]) .ss-home .ss-home-chip:hover{color:var(--accent-d);border-color:var(--accent)}' +
    '.ss-home-input,.ss-ov-input{width:100%;box-sizing:border-box;font-family:inherit;font-size:var(--fs-lg);color:#E2E8F0;' +
    'background:rgba(255,255,255,.07);border:1px solid rgba(96,165,250,.35);border-radius:var(--r-md);' +
    'padding:var(--gap-lg) var(--gap-xl);outline:none}' +
    '.ss-home-input:focus,.ss-ov-input:focus{border-color:rgba(96,165,250,.7);background:rgba(255,255,255,.1)}' +
    '.ss-home-results{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:9991;' +
    'background:#16213C;border:1px solid rgba(96,165,250,.35);border-radius:var(--r-md);max-height:70vh;overflow:auto;' +
    'box-shadow:0 18px 40px rgba(0,0,0,.5)}' +
    '.ss-item{display:flex;flex-direction:column;gap:var(--gap-2xs);padding:var(--gap-lg) var(--gap-xl);text-decoration:none;' +
    'border-bottom:1px solid rgba(255,255,255,.06)}' +
    '.ss-item:last-child{border-bottom:none}' +
    '.ss-item:hover{background:rgba(96,165,250,.1)}' +
    '.ss-it{font-size:var(--fs-md);color:#fff;font-weight:600}' +
    '.ss-ik{align-self:flex-start;font-size:var(--fs-2xs);color:#93C5FD;background:rgba(96,165,250,.14);' +
    'border:1px solid rgba(96,165,250,.3);border-radius:var(--r-sm);padding:1px var(--gap-sm);margin-top:var(--gap-2xs)}' +
    '.ss-id{font-size:var(--fs-xs);color:rgba(255,255,255,.55);line-height:var(--lh);margin-top:var(--gap-2xs)}' +
    '.ss-tip{font-size:var(--fs-xs);color:#94A3B8;padding:var(--gap-lg) var(--gap-xl);text-align:center;line-height:var(--lh)}' +
    '.ss-none{padding:var(--gap-2xl) var(--gap-xl);text-align:center}' +
    '.ss-none-t{color:rgba(255,255,255,.7);font-size:var(--fs-md);margin-bottom:var(--gap-sm)}' +
    '.ss-none-hint{color:rgba(255,255,255,.55);font-size:var(--fs-xs);margin:0 auto 10px;max-width:360px;line-height:var(--lh)}' +
    '.ss-ask{background:transparent;border:none;color:#60A5FA;font-size:var(--fs-sm);cursor:pointer;' +
    'text-decoration:underline;font-family:inherit}' +
    '.ss-submit{background:transparent;border:none;color:#60A5FA;font-size:var(--fs-sm);cursor:pointer;' +
    'text-decoration:underline;font-family:inherit}' +
    '.ss-acts{display:flex;gap:var(--gap-lg);justify-content:center;flex-wrap:wrap;margin-top:var(--gap-md)}' +
    '.ss-req{margin:var(--gap-md) auto 0;max-width:360px;text-align:left;background:rgba(255,255,255,.05);' +
    'border:1px dashed rgba(96,165,250,.35);border-radius:var(--r-sm);padding:var(--gap-md) var(--gap-lg)}' +
    '.ss-req-t{font-size:var(--fs-xs);color:rgba(255,255,255,.8);line-height:var(--lh);word-break:break-all}' +
    '.ss-req-btn{margin-top:var(--gap-sm);border:1px solid rgba(96,165,250,.4);background:rgba(96,165,250,.12);' +
    'color:#93C5FD;font-family:inherit;font-size:var(--fs-xs);font-weight:600;border-radius:var(--r-sm);' +
    'padding:var(--gap-xs) var(--gap-lg);cursor:pointer}' +
    '.ss-req-hint{margin-top:var(--gap-xs);font-size:var(--fs-2xs);color:rgba(255,255,255,.55);line-height:var(--lh)}' +
    '.ss-wx{color:#FBBF24;font-size:var(--fs-sm);margin-top:var(--gap-md);line-height:var(--lh)}' +
    '.ss-wx b{color:#fff;letter-spacing:1px}' +
    '.ss-overlay{position:fixed;inset:0;z-index:9995;background:rgba(10,15,32,.96);display:none;flex-direction:column;padding:var(--gap-lg)}' +
    '.ss-overlay.open{display:flex}' +
    '.ss-ov-head{display:flex;gap:var(--gap-md);align-items:center;margin-bottom:var(--gap-lg)}' +
    '.ss-ov-input{flex:1}' +
    '.ss-ov-close{flex-shrink:0;width:38px;height:38px;border-radius:50%;border:none;' +
    'background:rgba(255,255,255,.1);color:#CBD5E1;font-size:var(--fs-lg);cursor:pointer}' +
    '.ss-ov-results{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}' +
    '.ss-ov-results .ss-item{background:rgba(255,255,255,.04);border-radius:var(--r-sm);padding:var(--gap-lg) var(--gap-lg);' +
    'margin-bottom:var(--gap);border-bottom:none}' +
    '@media(min-width:760px){.ss-home{max-width:var(--w-wide)}}' +
    /* ---------- 主题化覆盖（2026-09-16 修）----------
       上面这套样式原先全部写死深色，导致白天模式下：搜索面板是黑的、输入框字色近乎全白看不见。
       首页/校园页各自写过浅色覆盖，但只覆盖了结果面板，没覆盖全屏面板。
       这里统一改用 theme.css 的变量 —— 白天自动浅色、夜间自动深色，13 个页面都不用再各写一遍。
       位置必须在上面所有规则之后（同优先级靠后生效）。 */
    '.ss-home-input,.ss-ov-input{color:var(--text);background:var(--card);border-color:var(--line2)}' +
    '.ss-home-input:focus,.ss-ov-input:focus{border-color:var(--accent);background:var(--card)}' +
    '.ss-home-results{background:var(--card);border-color:var(--line2)}' +
    '.ss-item{border-bottom-color:var(--line)}' +
    '.ss-item:hover{background:var(--brand-soft)}' +
    '.ss-it{color:var(--text)}' +
    '.ss-ik{color:var(--accent);background:var(--brand-soft);border-color:var(--brand-line)}' +
    '.ss-id{color:var(--sub)}' +
    '.ss-tip{color:var(--sub)}' +
    '.ss-none-t{color:var(--text)}' +
    '.ss-none-hint{color:var(--sub)}' +
    '.ss-ask{color:var(--accent)}' +
    '.ss-submit{color:var(--accent)}' +
    '.ss-req{background:var(--card2);border-color:var(--line2)}' +
    '.ss-req-t{color:var(--text2)}' +
    '.ss-req-btn{border-color:var(--line2);background:var(--card);color:var(--accent)}' +
    '.ss-req-hint{color:var(--sub)}' +
    '.ss-wx{color:var(--yellow)}' +
    '.ss-wx b{color:var(--text)}' +
    '.ss-overlay{background:var(--bg)}' +
    '.ss-ov-close{background:var(--card2);color:var(--sub2)}' +
    '.ss-ov-results .ss-item{background:var(--card)}' +
    '.ss-fab{background:linear-gradient(135deg,var(--accent),var(--purple))}' +
    /* 悬浮按钮 52px + 距底 26px = 78px，留 96px 让页面最后一块内容（分享卡）能完全让开。
       用 body.ss-has-fab（0,1,1）压过各页自己的 body{padding} 简写，顺序无关。 */
    'body.ss-has-fab{padding-bottom:96px}';

  function injectStyle() {
    if (document.getElementById('ss-style')) return;
    var st = document.createElement('style');
    st.id = 'ss-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function makeFab() {
    if (document.getElementById('ss-fab')) return;
    var b = document.createElement('button');
    b.id = 'ss-fab';
    b.className = 'ss-fab';
    b.type = 'button';
    b.title = '全站搜索';
    b.textContent = '🔍';
    b.addEventListener('click', openOverlay);
    document.body.appendChild(b);
    /* 悬浮按钮是 fixed 定位，会压在页面最底部的内容上 —— 手机上实测盖住了
       「分享给同学 / 复制链接 / 扫码分享」三个按钮，等于挡住操作。
       给 body 打一个类、由 CSS 补足底部留白（用类而不是插入占位元素：
       不受各脚本执行顺序影响，也不怕别的脚本再往 body 末尾追加东西）。 */
    document.body.classList.add('ss-has-fab');
  }

  function makeHomeBox() {
    if (document.getElementById('ss-home')) return;
    var box = document.createElement('div');
    box.id = 'ss-home';
    box.className = 'ss-home';
    box.innerHTML = '<div class="ss-home-box">' +
      '<span class="ss-home-ico" aria-hidden="true">🔍</span>' +
      '<input class="ss-home-input" id="ss-home-input" type="search" autocomplete="off" ' +
      'placeholder="搜关键词：宿舍 / 快递 / 转专业">' +
      '<button class="ss-home-btn" id="ss-home-btn" type="button">搜索</button>' +
      '<div class="ss-home-results" id="ss-home-results" hidden></div>' +
      '</div>' +
      /* 热门词：一键把词填进搜索框并直接出结果（比"猜关键词"省事） */
      '<div class="ss-home-hot">' +
      '<span class="ss-home-hot-t">大家在搜：</span>' +
      '<button class="ss-home-chip" type="button" data-q="社团">社团</button>' +
      '<button class="ss-home-chip" type="button" data-q="转专业">转专业</button>' +
      '<button class="ss-home-chip" type="button" data-q="宿舍">宿舍</button>' +
      '<button class="ss-home-chip" type="button" data-q="快递">快递</button>' +
      '</div>';
    var hero = document.querySelector('.hero') || document.body.firstElementChild;
    if (hero && hero.parentNode) hero.parentNode.insertBefore(box, hero.nextSibling);
    else document.body.insertBefore(box, document.body.firstChild);

    var input = box.querySelector('#ss-home-input');
    var res = box.querySelector('#ss-home-results');
    var showRes = function () { res.hidden = false; };
    var hideRes = function () { setTimeout(function () { res.hidden = true; }, 120); };
    /* 搜索按钮 / 热门词共用这一个动作：填词 → 展开面板 → 出结果
       第二参数 src 只给埋点用：'typed' = 自己输的 / 点的搜索按钮，'chip' = 点的热门词 */
    var runSearch = function (q, src) {
      if (typeof q === 'string') input.value = q;
      showRes();
      var v = input.value;
      if (!v) { res.textContent = ''; return; }
      ensureIndex().then(function () {
        renderInto(res, v);
        /* 埋点：一次真实搜索。等渲染完再上报 —— 「有没有结果」要按渲染后的 DOM 判，
           而「搜不到的词」是最有价值的需求信号，这个标记必须准。 */
        if (window.cjlt && window.cjlt.search) window.cjlt.search(v, res, src || 'typed');
      });
    };
    var btn = box.querySelector('#ss-home-btn');
    if (btn) btn.addEventListener('click', function () { input.focus(); runSearch(); });
    var chips = box.querySelectorAll('.ss-home-chip');
    for (var ci = 0; ci < chips.length; ci++) {
      chips[ci].addEventListener('click', function () {
        runSearch(this.getAttribute('data-q'), 'chip');
        input.focus();
      });
    }
    /* 埋点：他自己打字 → 停手 2.5 秒才算一次搜索。
       ⚠️ 不能借用上面那个 220ms 的 debounce —— 那是给结果面板即时刷新用的，
          拿它上报会把「宿」「宿舍」这类中间状态全记一遍。 */
    if (window.cjlt && window.cjlt.watchSearch) {
      window.cjlt.watchSearch(input, function () { return res; });
    }
    input.addEventListener('focus', showRes);
    document.addEventListener('click', function (ev) {
      if (!box.contains(ev.target)) hideRes();
    });
    input.addEventListener('keyup', debounce(function () {
      showRes();
      var q = input.value;
      if (!q) { res.textContent = ''; return; }
      ensureIndex().then(function () { renderInto(res, q); });
    }, 220));
    /* 输入法 composition 结束时也要搜一次 */
    input.addEventListener('compositionend', function () {
      showRes();
      var q = input.value;
      if (q) ensureIndex().then(function () { renderInto(res, q); });
    });
    res.addEventListener('click', function (ev) {
      var a = ev.target.closest('.ss-item');
      if (a) { location.href = a.getAttribute('href'); }
    });
  }

  var ovInput = null, ovResults = null;
  function openOverlay() {
    ensureIndex();
    var ov = document.getElementById('ss-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ss-overlay';
      ov.className = 'ss-overlay';
      ov.innerHTML = '<div class="ss-ov-head">' +
        '<input class="ss-ov-input" id="ss-ov-input" type="search" autocomplete="off" ' +
        'placeholder="搜关键词，比如：报到材料 / 快递地址 / 转专业">' +
        '<button class="ss-ov-close" type="button" aria-label="关闭">✕</button>' +
        '</div><div class="ss-ov-results" id="ss-ov-results"></div>';
      document.body.appendChild(ov);
      ovResults = ov.querySelector('#ss-ov-results');
      ovInput = ov.querySelector('#ss-ov-input');
      ov.querySelector('.ss-ov-close').addEventListener('click', function () { ov.classList.remove('open'); });
      ov.addEventListener('click', function (ev) {
        if (ev.target === ov) ov.classList.remove('open');
      });
      ovInput.addEventListener('keyup', debounce(function () {
        var q = ovInput.value;
        if (!q) { ovResults.textContent = ''; return; }
        ensureIndex().then(function () { renderInto(ovResults, q); });
      }, 220));
      ovInput.addEventListener('compositionend', function () {
        var q = ovInput.value;
        if (q) ensureIndex().then(function () { renderInto(ovResults, q); });
      });
      /* 埋点：全屏搜索框（右下角悬浮球点开的那个）和首页那个走同一套判定 ——
         停手 2.5 秒才算一次真实搜索 */
      if (window.cjlt && window.cjlt.watchSearch) {
        window.cjlt.watchSearch(ovInput, function () { return ovResults; });
      }
      ovResults.addEventListener('click', function (ev) {
        var a = ev.target.closest('.ss-item');
        if (a) location.href = a.getAttribute('href');
      });
    }
    ov.classList.add('open');
    setTimeout(function () { ovInput && ovInput.focus(); }, 50);
  }

  function mount() {
    try {
      injectStyle();
      if (isHome()) {
        makeHomeBox();
      } else {
        makeFab();
      }
    } catch (e) { /* 任何页面脚本异常都不该拖垮正文 */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
