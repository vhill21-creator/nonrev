(() => {
  const header = document.querySelector('.site-header');
  const brandImg = document.querySelector('.brand-img');
  const brandFallback = document.querySelector('.brand-fallback');
  if (brandImg && brandFallback) {
    const showFallback = () => { brandImg.hidden = true; brandFallback.style.display = 'inline'; };
    brandImg.addEventListener('error', showFallback);
    if (brandImg.complete && brandImg.naturalWidth === 0) showFallback();
  }
  const toggle = document.querySelector('#menu-toggle');
  const mobile = document.querySelector('#mobile-nav');
  if (toggle && mobile) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobile.hidden = !open;
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    mobile.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
    document.addEventListener('click', event => { if (!header.contains(event.target)) setOpen(false); });
  }
  // Only apply prevalidated plain text and media URLs. Never insert editable HTML.
  if (document.querySelector('[data-edit-key], [data-edit-image], [data-edit-youtube]')) {
    fetch('/api/content', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : { values: {} })
      .then(({ values = {} }) => {
        document.querySelectorAll('[data-edit-key]').forEach(node => {
          const value = values[node.getAttribute('data-edit-key')];
          if (typeof value === 'string' && value) node.textContent = value;
        });
        document.querySelectorAll('img[data-edit-image]').forEach(node => {
          const url = values[node.getAttribute('data-edit-image')];
          if (typeof url === 'string' && /^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_.~-]+$/.test(url)) node.src = url;
        });
        document.querySelectorAll('[data-edit-youtube]').forEach(node => {
          const id = values[node.getAttribute('data-edit-youtube')];
          if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
          if (node.tagName === 'IFRAME') node.src = 'https://www.youtube-nocookie.com/embed/' + id;
          if (node.tagName === 'A') node.href = 'https://www.youtube.com/watch?v=' + id;
        });
      }).catch(() => {});
  }

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = document.getElementById('form-status');
      const button = form.querySelector('[type="submit"]');
      status.className = '';
      status.textContent = '';
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const payload = Object.fromEntries(fields.entries());
      const subject = 'Nonrev website inquiry: ' + (payload.topic || 'General');
      const body = 'Name: ' + payload.name + '\nEmail: ' + payload.email + '\nTopic: ' + payload.topic + '\n\n' + payload.message;
      const fallback = 'mailto:info@nonrevchristianmusic.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Form service unavailable.');
        form.reset();
        status.className = 'form-success';
        status.textContent = 'Thanks for reaching out. Your message has been sent.';
      } catch (_) {
        status.className = 'form-help';
        status.textContent = 'The web form is not configured yet. Your email app will open so you can send your message directly.';
        window.location.href = fallback;
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  }
})();
