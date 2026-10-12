(function () {
  const passages = window.VERSES;
  const N = passages.length;

  const card = document.getElementById('card');
  const verseEl = document.getElementById('verse');
  const refEl = document.getElementById('ref');
  const counterEl = document.getElementById('counter');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const segBtns = Array.from(document.querySelectorAll('.seg-btn'));

  const STORE_KEY = 'scriptureShield.translation';
  function loadTranslation() {
    try {
      const v = localStorage.getItem(STORE_KEY);
      if (v === 'kjv' || v === 'bsb') return v;
    } catch (e) {}
    return 'kjv';
  }
  function saveTranslation(v) {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
  }

  let translation = loadTranslation();

  function randInt(max) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  function shuffled(avoidFirst) {
    const a = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (avoidFirst != null && N > 1 && a[0] === avoidFirst) {
      const j = 1 + randInt(N - 1);
      [a[0], a[j]] = [a[j], a[0]];
    }
    return a;
  }

  const seq = shuffled();
  let pos = 0;

  function sizeClass(len) {
    if (len <= 90) return 's1';
    if (len <= 190) return 's2';
    if (len <= 320) return 's3';
    return 's4';
  }

  function render() {
    const p = passages[seq[pos]];
    const verses = p[translation];
    const multi = verses.length > 1;
    const total = verses.reduce((n, [, t]) => n + t.length, 0);

    verseEl.textContent = '';
    verses.forEach(([num, text], i) => {
      if (multi) {
        const sup = document.createElement('sup');
        sup.textContent = num;
        verseEl.appendChild(sup);
      }
      verseEl.appendChild(document.createTextNode(text + (i < verses.length - 1 ? ' ' : '')));
    });
    verseEl.className = 'verse ' + sizeClass(total);
    refEl.textContent = p.r;
    counterEl.textContent = (pos % N) + 1 + ' / ' + N;
    prevBtn.disabled = pos === 0;
    card.scrollTop = 0;
  }

  let swapTimer = null;

  function swap() {
    card.classList.add('leaving');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      render();
      card.classList.remove('leaving');
    }, 140);
  }

  function go(delta) {
    if (delta < 0 && pos === 0) return;
    if (delta > 0 && pos + 1 >= seq.length) {
      seq.push(...shuffled(seq[seq.length - 1]));
    }
    pos += delta;
    prevBtn.disabled = pos === 0;
    swap();
  }

  function syncTranslationUi() {
    segBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tr === translation)));
  }

  function setTranslation(next) {
    if (next === translation) return;
    translation = next;
    saveTranslation(next);
    syncTranslationUi();
    swap();
  }

  segBtns.forEach((b) =>
    b.addEventListener('click', (e) => {
      setTranslation(b.dataset.tr);
      if (e.detail) b.blur();
    })
  );

  prevBtn.addEventListener('click', (e) => { if (e.detail) go(-1); });
  nextBtn.addEventListener('click', (e) => { if (e.detail) go(1); });

  let isFullscreen = false;
  async function setFullscreen(on) {
    if (typeof window.setFullscreen !== 'function') return;
    try { isFullscreen = await window.setFullscreen(on); } catch (err) {}
  }

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'F11') {
      e.preventDefault();
      setFullscreen(!isFullscreen);
      return;
    }
    if (e.key === 'Escape' && isFullscreen) {
      e.preventDefault();
      setFullscreen(false);
      return;
    }
    const onToggle = e.target && e.target.closest && e.target.closest('.seg');
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (!onToggle && (e.key === ' ' || e.key === 'Enter'))) {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (!onToggle && e.key === 'Backspace')) {
      e.preventDefault();
      go(-1);
    }
  });

  [prevBtn, nextBtn].forEach((b) => b.addEventListener('mouseup', () => b.blur()));

  syncTranslationUi();
  render();
})();
