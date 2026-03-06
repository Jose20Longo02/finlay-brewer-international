(function () {
  /* Hero load animation */
  const heroContent = document.querySelector('.fs-hero-content') || document.querySelector('.about-hero-content');
  if (heroContent) {
    requestAnimationFrame(function () {
      heroContent.classList.add(heroContent.classList.contains('about-hero-content') ? 'loaded' : 'fs-hero-loaded');
    });
  }

  /* Results carousel - continuous scroll */
  (function () {
    var track = document.querySelector('.fs-results-track');
    var cards = document.querySelectorAll('.fs-result-card');
    if (!track || cards.length < 6) return;

    var offset = 0;
    var segmentWidth = 0;
    var speed = 2.5;
    var paused = false;
    var wrap = track.closest('.fs-results-carousel-wrap');

    function updateCenterCard() {
      var vCenter = window.innerWidth / 2;
      var closest = 0;
      var minDist = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].getBoundingClientRect();
        var c = r.left + r.width / 2;
        var d = Math.abs(c - vCenter);
        if (d < minDist) { minDist = d; closest = i; }
      }
      cards.forEach(function (c, i) { c.classList.toggle('active', i === closest); });
    }

    function tick() {
      if (!paused) {
        offset -= speed;
        if (!segmentWidth && cards[3]) segmentWidth = cards[3].offsetLeft;
        if (segmentWidth && -offset >= segmentWidth) {
          offset += segmentWidth;
        }
      }
      track.style.transform = 'translate3d(' + offset + 'px, 0, 0)';
      updateCenterCard();
      requestAnimationFrame(tick);
    }

    wrap.addEventListener('mouseenter', function () { paused = true; });
    wrap.addEventListener('mouseleave', function () { paused = false; });
    tick();
  })();

  /* Hero word rotation - slide up from below */
  const words = document.querySelectorAll('.fs-hero-word');
  if (words.length > 1) {
    let i = 0;
    setInterval(function () {
      const current = words[i];
      current.classList.add('exiting');
      current.classList.remove('active');
      i = (i + 1) % words.length;
      words[i].classList.add('active');
      setTimeout(function () {
        current.classList.remove('exiting');
      }, 500);
    }, 2500);
  }

  const form = document.getElementById('fsContactForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('.fs-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    const firstName = form.querySelector('[name="firstName"]').value.trim();
    const lastName = form.querySelector('[name="lastName"]').value.trim();
    const countryCode = form.querySelector('[name="countryCode"]').value.trim();
    const phone = form.querySelector('[name="phone"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const message = form.querySelector('[name="message"]').value.trim();

    const name = [firstName, lastName].filter(Boolean).join(' ');
    const fullPhone = [countryCode, phone].filter(Boolean).join(' ');
    const source = document.body.classList.contains('page-about') ? 'contact_form' : 'for_sellers';

    const data = { name, email, phone: fullPhone || undefined, message, source };

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then((r) => r.json())
      .then(function (res) {
        if (res.success) {
          form.reset();
          showMessage(res.message || 'Thank you! We will be in touch soon.', 'success');
        } else {
          showMessage(res.message || 'Something went wrong. Please try again.', 'error');
        }
      })
      .catch(function () {
        showMessage('Something went wrong. Please try again.', 'error');
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit';
        }
      });
  });

  function showMessage(text, type) {
    const el = document.createElement('div');
    el.className = `fs-message fs-message-${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 100);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
})();
