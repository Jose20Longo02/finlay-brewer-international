// Header hamburger menu toggle
document.addEventListener('DOMContentLoaded', function () {
  const siteHeader = document.querySelector('.site-header');
  const hamburger = document.getElementById('header-hamburger');
  const overlay = document.getElementById('header-overlay');
  const panel = document.getElementById('header-nav-panel');

  function openMenu() {
    if (siteHeader) siteHeader.classList.add('menu-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    if (overlay) overlay.setAttribute('aria-hidden', 'false');
    if (panel) panel.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeMenu() {
    if (siteHeader) siteHeader.classList.remove('menu-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    if (panel) panel.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      if (siteHeader && siteHeader.classList.contains('menu-open')) closeMenu();
      else openMenu();
    });
  }
  if (overlay) overlay.addEventListener('click', closeMenu);

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024) closeMenu();
  });

  // Close menu when a nav link is clicked (for in-page anchors)
  if (panel) {
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }
});

// Black header: hide on scroll down, show on scroll up (property list page only)
document.addEventListener('DOMContentLoaded', function () {
  if (!document.body.classList.contains('header-dark')) return;
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScrollY = window.scrollY || window.pageYOffset;
  const scrollThreshold = 10;

  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    const delta = scrollY - lastScrollY;

    if (scrollY < 50) {
      header.classList.remove('header-scrolled-down');
      lastScrollY = scrollY;
      return;
    }

    if (Math.abs(delta) < scrollThreshold) return;

    if (delta > 0) {
      header.classList.add('header-scrolled-down');
    } else {
      header.classList.remove('header-scrolled-down');
    }
    lastScrollY = scrollY;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
});

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


