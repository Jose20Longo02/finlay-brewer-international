(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('.contact-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    const fd = new FormData(form);
    const data = Object.fromEntries([...fd].filter(([, v]) => v !== ''));

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
          btn.textContent = 'Send';
        }
      });
  });

  function showMessage(text, type) {
    const el = document.createElement('div');
    el.className = `contact-message contact-message-${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 100);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
})();
