/**
 * Generates inline JavaScript for slide navigation.
 * Supports browse mode (auto-reveal fragments) and present mode (manual fragment advance).
 */
export function buildNavJS(): string {
  return `
(function() {
  var slides = document.querySelectorAll('.slide');
  var total = slides.length;
  var current = 0;
  var mode = 'browse';

  /* ── Rescale ── */
  function rescale() {
    var sd = document.querySelector('.slide-deck');
    if (!sd) return;
    var sx = window.innerWidth / 1280;
    var sy = window.innerHeight / 720;
    var s = Math.min(sx, sy);
    sd.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', rescale);
  rescale();

  /* ── Fragments ── */
  function getFragments(slide) {
    return slide ? Array.from(slide.querySelectorAll('.fragment')) : [];
  }

  function revealAllFragments(slide) {
    getFragments(slide).forEach(function(f) { f.classList.add('visible'); });
  }

  function hideAllFragments(slide) {
    getFragments(slide).forEach(function(f) { f.classList.remove('visible'); });
  }

  function getVisibleCount(slide) {
    return slide ? slide.querySelectorAll('.fragment.visible').length : 0;
  }

  /* ── Show Slide ── */
  function showSlide(idx) {
    if (idx < 0 || idx >= total) return;
    slides.forEach(function(s, i) {
      s.classList.toggle('active', i === idx);
      s.style.display = i === idx ? 'flex' : 'none';
    });
    current = idx;

    var slide = slides[current];
    if (mode === 'browse') {
      revealAllFragments(slide);
    } else {
      hideAllFragments(slide);
    }

    updateUI();
    notifyParent({ slideChanged: current });
  }

  /* ── Present Mode: Fragment Control ── */
  function advanceFragment() {
    var slide = slides[current];
    var hidden = slide.querySelectorAll('.fragment:not(.visible)');
    if (hidden.length > 0) {
      hidden[0].classList.add('visible');
      updateUI();
    } else {
      if (current < total - 1) showSlide(current + 1);
    }
  }

  function retreatFragment() {
    var slide = slides[current];
    var visible = Array.from(slide.querySelectorAll('.fragment.visible'));
    if (visible.length > 0) {
      visible[visible.length - 1].classList.remove('visible');
      updateUI();
    } else {
      if (current > 0) {
        showSlide(current - 1);
        revealAllFragments(slides[current]);
        updateUI();
      }
    }
  }

  /* ── Navigation ── */
  function nextSlide() { if (current < total - 1) showSlide(current + 1); }
  function prevSlide() { if (current > 0) showSlide(current - 1); }

  /* ── UI Update ── */
  function updateUI() {
    var counter = document.getElementById('page-counter');
    if (counter) counter.textContent = (current + 1) + ' / ' + total;

    var bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = ((current + 1) / total * 100) + '%';

    var fp = document.getElementById('fragment-progress');
    if (fp) {
      if (mode === 'present') {
        var frags = getFragments(slides[current]);
        var vis = getVisibleCount(slides[current]);
        if (frags.length > 0) {
          var dots = frags.map(function(_, i) { return i < vis ? '\\u25cf' : '\\u25cb'; }).join(' ');
          fp.textContent = dots + ' (' + vis + '/' + frags.length + ')';
          fp.style.display = 'inline';
        } else {
          fp.style.display = 'none';
        }
      } else {
        fp.style.display = 'none';
      }
    }

    var presentBtn = document.getElementById('present-btn');
    var exitBtn = document.getElementById('exit-btn');
    if (presentBtn) presentBtn.style.display = mode === 'browse' ? 'inline-block' : 'none';
    if (exitBtn) exitBtn.style.display = mode === 'present' ? 'inline-block' : 'none';
  }

  /* ── Mode Switch ── */
  function enterPresent() {
    mode = 'present';
    document.body.classList.add('present-mode');
    hideAllFragments(slides[current]);
    updateUI();
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
  }

  function exitPresent() {
    mode = 'browse';
    document.body.classList.remove('present-mode');
    revealAllFragments(slides[current]);
    updateUI();
    if (document.fullscreenElement) document.exitFullscreen();
  }

  document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && mode === 'present') {
      mode = 'browse';
      document.body.classList.remove('present-mode');
      revealAllFragments(slides[current]);
      updateUI();
      notifyParent({ modeChanged: 'browse' });
    }
  });

  /* ── Parent Communication ── */
  var _suppressNotify = false;
  function notifyParent(data) {
    if (_suppressNotify) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
  }

  window.addEventListener('message', function(e) {
    if (e.data && typeof e.data.goToSlide === 'number') {
      showSlide(e.data.goToSlide);
    }
    if (e.data && e.data.setMode === 'present') {
      enterPresent();
    }
    if (e.data && e.data.setMode === 'browse') {
      exitPresent();
    }
  });

  /* ── Keyboard ── */
  var debounce = 0;
  document.addEventListener('keydown', function(e) {
    var now = Date.now();
    if (now - debounce < 100) return;
    debounce = now;

    if (mode === 'present') {
      switch(e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'Enter': case 'PageDown':
          e.preventDefault();
          advanceFragment();
          break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault();
          retreatFragment();
          break;
        case 'Escape':
          exitPresent();
          break;
      }
    } else {
      switch(e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'Enter': case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault();
          prevSlide();
          break;
      }
    }
  });

  /* ── Button Handlers ── */
  var navPrev = document.getElementById('nav-prev');
  var navNext = document.getElementById('nav-next');
  if (navPrev) navPrev.addEventListener('click', function() {
    mode === 'present' ? retreatFragment() : prevSlide();
  });
  if (navNext) navNext.addEventListener('click', function() {
    mode === 'present' ? advanceFragment() : nextSlide();
  });

  var presentBtn = document.getElementById('present-btn');
  if (presentBtn) presentBtn.addEventListener('click', enterPresent);

  var exitBtn = document.getElementById('exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', exitPresent);

  window.__slideNav = { enterPresent: enterPresent, exitPresent: exitPresent };

  /* ── Init ── */
  _suppressNotify = true;
  showSlide(0);
  _suppressNotify = false;
})();
`;
}
