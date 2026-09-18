/* ============================================================
   archive.js —— 过期归档区配套脚本（2026-09-11）
   只做一件事：外部链接直接跳到归档区里的某条（例如 contents.html
   里的 timeline.html#pack）时，自动把归档区展开，否则内容藏在
   折叠块里，点进来的人会看不到。
   加新页面：引入本文件即可，无需改动。
   ============================================================ */
(function () {
  function openForHash() {
    var id = (location.hash || '').slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var box = el.closest ? el.closest('details') : null;
    if (!box) return;
    box.open = true;
    // 展开后重新对齐，避免被顶部导航挡住
    var top = box.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
  }

  window.addEventListener('hashchange', openForHash);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openForHash);
  } else {
    openForHash();
  }
})();
