(() => {
  const $ = id => document.getElementById(id);
  const LS_KEY = 'prompter.v1';
  const LINE = 1.35; // must match #content line-height

  const DEFAULT_SCRIPT = `Welcome to Free to Prompt.

A free, open source teleprompter by Waldo Webster.

Built for anyone with something to say. No signup, no subscriptions. Your script stays in your browser.

Explore the code, suggest an improvement, or contribute on GitHub. Find Waldo at waldo.biz.

Your words. Your pace. Press play.`;

  const s = { text: DEFAULT_SCRIPT, size: 46, bright: 100, speed: 20, width: 80, mirrorH: false, mirrorV: false };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      if (typeof saved.text === 'string') s.text = saved.text;
      for (const [key, min, max] of [['size', 24, 160], ['bright', 15, 100], ['speed', 1, 100], ['width', 40, 96]]) {
        if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) s[key] = Math.min(max, Math.max(min, saved[key]));
      }
      for (const key of ['mirrorH', 'mirrorV']) s[key] = saved[key] === true;
    }
  } catch {}
  const save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
    catch { $('saveStatus').textContent = 'Not saved'; }
  };

  const stage = $('stage'), content = $('content'), script = $('script');
  let prompting = false, playing = false;
  let pos = 0, max = 0;
  let hold = 0, holdStart = 0;      // -1 = scrolling back, 1 = forward (arrow key held)
  let idleTimer = 0, toastTimer = 0;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pxPerSec = () => s.speed * s.size * LINE / 40;   // speed 20 = half a line per second

  // ---------- settings ----------
  function apply() {
    const root = document.documentElement.style;
    root.setProperty('--size', s.size + 'px');
    root.setProperty('--bright', s.bright + '%');
    root.setProperty('--width', s.width + '%');
    $('reading').style.transform = `scale(${s.mirrorH ? -1 : 1}, ${s.mirrorV ? -1 : 1})`;
    for (const k of ['speed', 'size', 'bright', 'width']) {
      $(k).value = s[k];
      $(k).style.setProperty('--progress', ((s[k] - +$(k).min) / (+$(k).max - +$(k).min) * 100) + '%');
      $(k + 'Out').textContent = s[k] + (k === 'bright' || k === 'width' ? '%' : '');
    }
    $('mirrorH').checked = s.mirrorH;
    $('mirrorV').checked = s.mirrorV;
    measure();
    save();
  }

  function measure() {
    if (!prompting) return;
    const ratio = max > 0 ? pos / max : 0;
    // Content has 30vh top + 75vh bottom padding, so this is the height of the text itself.
    max = Math.max(0, content.offsetHeight - stage.clientHeight * 1.05);
    pos = ratio * max;
  }

  function set(key, value) {
    const el = $(key);
    s[key] = el && el.type === 'range' ? clamp(value, +el.min, +el.max) : value;
    apply();
  }

  // ---------- modes ----------
  function startPrompting() {
    if (!script.value.trim()) { script.focus(); return; }
    s.text = script.value; save();
    content.replaceChildren(...s.text.split(/\r?\n/).filter(l => l.trim()).map(l => {
      const p = document.createElement('p'); p.textContent = l; return p;
    }));
    prompting = true; playing = true; pos = 0; max = 0; hold = 0;
    document.body.classList.add('prompting');
    $('editor').hidden = true; stage.hidden = false;
    $('btnMode').textContent = 'Edit Script'; $('btnMode').classList.remove('primary');
    $('btnPlay').hidden = $('btnTop').hidden = false;
    if (document.activeElement) document.activeElement.blur();
    shownRemaining = '';
    measure(); syncPlay(); wake();
    $('btnPlay').focus();
    requestWakeLock();
  }

  function stopPrompting() {
    prompting = false; playing = false; hold = 0;
    document.body.classList.remove('prompting', 'idle');
    $('editor').hidden = false; stage.hidden = true;
    $('btnMode').textContent = 'Play'; $('btnMode').classList.add('primary');
    $('btnPlay').hidden = $('btnTop').hidden = true;
    $('remaining').textContent = '';
    releaseWakeLock();
    script.focus();
  }

  function syncPlay() {
    $('btnPlay').textContent = playing ? 'Pause' : 'Play';
    $('paused').hidden = playing;
    $('paused').textContent = pos >= max && max > 0 ? 'Finished' : 'Paused';
    $('btnPlay').setAttribute('aria-pressed', String(playing));
    wake();
  }
  function togglePlay() {
    if (!playing && pos >= max) pos = 0;   // at the end: restart from the top
    playing = !playing; syncPlay();
  }
  function toTop() { pos = 0; playing = false; syncPlay(); }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 900);
  }

  // Show the control bar on mouse movement, hide it again after a pause.
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (prompting && playing && !$('bar').contains(document.activeElement)) document.body.classList.add('idle'); }, 2500);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch { toast('Fullscreen unavailable'); }
  }
  $('btnFull').hidden = !document.fullscreenEnabled;
  document.addEventListener('fullscreenchange', () => {
    $('btnFull').textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    measure();
  });
  let wakeLock = null;
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.hidden || !prompting || wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!prompting || document.hidden) { await lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } catch { /* A denied wake lock must never prevent prompting. */ }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hold = 0; playing = false; syncPlay(); releaseWakeLock(); }
    else if (prompting) requestWakeLock();
  });

  // ---------- animation loop ----------
  let last = performance.now(), shownRemaining = '';
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (prompting) {
      if (hold) {
        const linesPerSec = (t - holdStart) > 1200 ? 9 : 2.5;   // speeds up if you keep holding
        pos += hold * linesPerSec * s.size * LINE * dt;
      } else if (playing) {
        pos += pxPerSec() * dt;
      }
      pos = clamp(pos, 0, max);
      if (playing && pos >= max) { playing = false; syncPlay(); }
      content.style.transform = `translate3d(0, ${-pos}px, 0)`;

      const secs = Math.ceil((max - pos) / pxPerSec());
      const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left`;
      if (label !== shownRemaining) $('remaining').textContent = shownRemaining = label;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- input ----------
  window.addEventListener('keydown', e => {
    if ($('resetDialog').open || $('shortcuts').open) return;
    if (!prompting) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); startPrompting(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); stopPrompting(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('button, input, a, textarea, dialog')) return;
    let handled = true;
    switch (e.key) {
      case ' ': case 'Enter': if (!e.repeat) togglePlay(); break;
      case 'ArrowUp':   if (hold !== -1) { hold = -1; holdStart = performance.now(); } break;
      case 'ArrowDown': if (hold !== 1)  { hold = 1;  holdStart = performance.now(); } break;
      case 'ArrowLeft':  set('speed', s.speed - 2); toast('Speed ' + s.speed); break;
      case 'ArrowRight': set('speed', s.speed + 2); toast('Speed ' + s.speed); break;
      case 'PageUp':   pos -= window.innerHeight * 0.5; break;
      case 'PageDown': pos += window.innerHeight * 0.5; break;
      case '-': case '_': set('size', s.size - 4); toast('Size ' + s.size); break;
      case '=': case '+': set('size', s.size + 4); toast('Size ' + s.size); break;
      case 'Home': case 'r': case 'R': toTop(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': set('mirrorH', !s.mirrorH); break;
      case 'Escape': stopPrompting(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      wake();
    }
  }, true);

  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' && hold === -1) hold = 0;
    if (e.key === 'ArrowDown' && hold === 1) hold = 0;
  }, true);
  window.addEventListener('blur', () => { hold = 0; });

  stage.addEventListener('wheel', e => { e.preventDefault(); pos += e.deltaY * (s.mirrorV ? -1 : 1); }, { passive: false });
  let touchY = null, dragged = false;
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    touchY = e.clientY; dragged = false;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (touchY === null) return;
    const delta = touchY - e.clientY;
    if (Math.abs(delta) > 3 || dragged) {
      dragged = true; pos = clamp(pos + delta * (s.mirrorV ? -1 : 1), 0, max);
      touchY = e.clientY; wake();
    }
  });
  stage.addEventListener('pointerup', () => { touchY = null; });
  stage.addEventListener('pointercancel', () => { touchY = null; dragged = true; });
  stage.addEventListener('click', () => { if (!dragged) togglePlay(); dragged = false; });
  $('bar').addEventListener('focusin', wake);
  $('bar').addEventListener('pointerdown', wake);
  window.addEventListener('mousemove', () => { if (prompting) wake(); });
  window.addEventListener('resize', measure);

  for (const k of ['speed', 'size', 'bright', 'width']) {
    $(k).addEventListener('input', e => { set(k, +e.target.value); if (prompting) wake(); });
  }
  $('mirrorH').addEventListener('change', e => set('mirrorH', e.target.checked));
  $('mirrorV').addEventListener('change', e => set('mirrorV', e.target.checked));
  $('btnMode').addEventListener('click', () => prompting ? stopPrompting() : startPrompting());
  $('btnPlay').addEventListener('click', e => { togglePlay(); e.currentTarget.blur(); });
  $('btnTop').addEventListener('click', e => { toTop(); e.currentTarget.blur(); });
  $('btnFull').addEventListener('click', e => { toggleFullscreen(); e.currentTarget.blur(); });
  function updateEditor() {
    const words = script.value.trim().match(/\S+/g)?.length || 0;
    $('wordCount').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    $('btnMode').disabled = !words;
    $('btnExport').disabled = !words;
    $('btnReset').disabled = !script.value.length;
  }
  script.addEventListener('input', () => { s.text = script.value; save(); updateEditor(); });
  $('btnImport').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) { $('saveStatus').textContent = 'File exceeds 2 MB'; return; }
      const text = await file.text();
      if (script.value.trim() && !window.confirm('Replace your current script with this file?')) return;
      script.value = s.text = text; save(); updateEditor(); script.focus();
    } catch { $('saveStatus').textContent = 'Could not open file'; }
    finally { e.target.value = ''; }
  });
  $('btnExport').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([script.value], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'freetoprompt-script.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('btnReset').addEventListener('click', () => $('resetDialog').showModal());
  $('btnCancelReset').addEventListener('click', () => $('resetDialog').close());
  $('btnConfirmReset').addEventListener('click', () => {
    script.value = s.text = '';
    save();
    updateEditor();
    $('resetDialog').close();
    script.focus();
  });
  $('btnKeys').addEventListener('click', () => $('shortcuts').showModal());
  $('btnCloseKeys').addEventListener('click', () => $('shortcuts').close());

  script.value = s.text;
  updateEditor();
  apply();
})();
