(() => {
  const form = document.getElementById('editor-form');
  const host = document.getElementById('editor-fields');
  const status = document.getElementById('editor-status');
  if (!form || !host || !status) return;
  let fields = {};
  function show(message, error = false) { status.textContent = message; status.className = error ? 'error' : 'success'; }
  fetch('/api/admin/content', { credentials: 'same-origin', cache: 'no-store' })
    .then(res => { if (!res.ok) throw Error('Editor is not configured or you are not authorized.'); return res.json(); })
    .then(data => {
      fields = data.fields;
      for (const [name, spec] of Object.entries(fields)) {
        const label = document.createElement('label');
        label.textContent = spec.label;
        const input = spec.type === 'text' ? document.createElement('textarea') : document.createElement('input');
        if (spec.type !== 'text') input.type = 'text';
        else input.rows = 3;
        input.name = name;
        input.maxLength = spec.max;
        input.value = data.values?.[name] || '';
        input.placeholder = spec.type === 'image' ? 'https://static.wixstatic.com/media/...' : spec.type === 'youtube' ? '11-character video ID' : 'Leave blank for original website wording';
        label.appendChild(input);
        const help = document.createElement('small');
        help.textContent = 'Up to ' + spec.max + ' characters. Blank restores original website content.';
        label.appendChild(help);
        host.appendChild(label);
      }
      show('Editor ready. You can update the fields below.');
    }).catch(err => show(err.message, true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = {};
    for (const name of Object.keys(fields)) {
      const item = form.elements.namedItem(name);
      if (item) values[name] = item.value.trim();
    }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    show('Saving...');
    try {
      const res = await fetch('/api/admin/content', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Save failed');
      show('Changes saved. Refresh the website to see the updates.');
    } catch (err) { show(err.message, true); }
    finally { button.disabled = false; }
  });
})();
