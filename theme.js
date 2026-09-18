/* ============================================================
   theme.js —— 白天 / 黑夜模式切换（2026-09-11）
   用法：在 <head> 里、theme.css 后面引一行即可，页面其它地方不用管：
        <script src="theme.js?v=20260911c"></script>

   规则：
   · 没选过 → 跟随系统设置（手机开深色，网页就是深色）
   · 点过右下角按钮 → 记住你的选择，换页、关机、第二天打开都还在
   · 想恢复"跟随系统"：手机浏览器设置里清掉本网站数据即可
   ============================================================ */
(function () {
  var KEY = 'cjl-theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function systemDark() { return !!(mq && mq.matches); }
  function effective() {
    var s = saved();
    if (s === 'dark' || s === 'light') return s;
    return systemDark() ? 'dark' : 'light';
  }

  /* 1) 先把主题贴上去，避免页面闪一下白 */
  root.setAttribute('data-theme', effective());

  /* 2) 手机浏览器地址栏颜色跟着变 */
  function paintMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = effective() === 'dark' ? '#0B1220' : '#F5F8FC';
  }
  paintMeta();

  /* 3) 右下角按钮 */
  function paintBtn(b) {
    var dark = effective() === 'dark';
    b.innerHTML = '<span class="tb-tip">' + (dark ? '切到白天模式' : '切到黑夜模式') + '</span>' + (dark ? '☀️' : '🌙');
    b.title = dark ? '切到白天模式' : '切到黑夜模式';
  }

  function addBtn() {
    if (document.querySelector('.theme-btn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-btn';
    b.setAttribute('aria-label', '切换白天/黑夜模式');
    paintBtn(b);
    b.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* 隐私模式忽略 */ }
      root.classList.add('theme-anim');
      root.setAttribute('data-theme', next);
      paintMeta();
      paintBtn(b);
      setTimeout(function () { root.classList.remove('theme-anim'); }, 320);
    });
    document.body.appendChild(b);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addBtn);
  } else {
    addBtn();
  }

  /* 4) 没手动选过时，跟着系统走 */
  if (mq) {
    var onChange = function () {
      if (saved()) return;
      root.setAttribute('data-theme', effective());
      paintMeta();
      var b = document.querySelector('.theme-btn');
      if (b) paintBtn(b);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
