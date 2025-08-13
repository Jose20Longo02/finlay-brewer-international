// Mobile sidebar toggle for superadmin dashboard
document.addEventListener('DOMContentLoaded', function () {
  const panel = document.querySelector('.admin-panel');
  const toggle = document.querySelector('.mobile-nav-toggle');
  const overlay = document.querySelector('.admin-overlay');
  const sidebar = document.getElementById('superadmin-sidebar');
  if (!panel || !toggle || !overlay || !sidebar) return;

  function openSidebar() {
    panel.classList.add('sidebar-open');
    toggle.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeSidebar() {
    panel.classList.remove('sidebar-open');
    toggle.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }
  toggle.addEventListener('click', function () {
    if (panel.classList.contains('sidebar-open')) closeSidebar(); else openSidebar();
  });
  overlay.addEventListener('click', closeSidebar);
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) closeSidebar();
  });
});


