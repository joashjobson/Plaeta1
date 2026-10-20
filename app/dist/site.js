// Plaeta website behaviour. Prices and links come from config.js.
(function () {
  var C = window.PLAETA || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // Links and details from the settings file
  document.querySelectorAll('[data-app]').forEach(function (a) { a.href = C.appUrl || '#'; });
  document.querySelectorAll('[data-cfg]').forEach(function (el) {
    var v = C[el.getAttribute('data-cfg')]; if (v == null) return;
    el.textContent = v;
    if (el.tagName === 'A' && el.getAttribute('data-cfg') === 'contactEmail') el.href = 'mailto:' + v;
  });
  var yr = document.getElementById('year'); if (yr) yr.textContent = new Date().getFullYear();

  // Price plans
  var plansEl = document.getElementById('plans');
  if (plansEl && C.plans) {
    var inc = (C.included || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    plansEl.innerHTML = C.plans.map(function (p, i) {
      return '<article class="plan reveal d' + (i + 1) + (p.recommended ? ' rec' : '') + '">' +
        (p.recommended ? '<span class="flag">Recommended</span>' : '') +
        '<h3>' + esc(p.name) + '</h3><p class="blurb">' + esc(p.blurb || '') + '</p>' +
        '<div class="price"><span class="amt">' + esc(C.currency || '$') + esc(p.price) + '</span><span class="per">/ month</span></div>' +
        '<span class="papers">' + esc(p.papers) + ' past papers a month</span>' +
        '<ul>' + inc + '</ul>' +
        '<a class="btn btn-primary" href="start.html?plan=' + encodeURIComponent(p.id) + '">Choose ' + esc(p.name) + ' <span class="arr">&rarr;</span></a>' +
        '</article>';
    }).join('');
  }

  // Plan picker on the Get started page
  var picker = document.getElementById('picker');
  if (picker && C.plans) {
    var want = new URLSearchParams(location.search).get('plan');
    var chosen = C.plans.some(function (p) { return p.id === want; }) ? want : (C.plans.filter(function (p) { return p.recommended; })[0] || C.plans[0]).id;
    picker.innerHTML = C.plans.map(function (p) {
      return '<label class="pick"><input type="radio" name="plan" value="' + esc(p.id) + '"' + (p.id === chosen ? ' checked' : '') + '>' +
        '<span><span class="nm">' + esc(p.name) + '</span><br><span class="sub">' + esc(p.papers) + ' past papers a month</span></span>' +
        '<span class="pr">' + esc(C.currency || '$') + esc(p.price) + ' <small>/ mo</small></span></label>';
    }).join('');
    var label = document.getElementById('chosen');
    var sync = function () {
      var id = (picker.querySelector('input:checked') || {}).value, p = C.plans.filter(function (x) { return x.id === id; })[0];
      if (label && p) label.textContent = p.name + ', ' + (C.currency || '$') + p.price + ' a month';
    };
    picker.addEventListener('change', sync); sync();
  }

  // Nav border once you scroll
  var nav = document.querySelector('.nav');
  if (nav) { var onS = function () { nav.classList.toggle('scrolled', scrollY > 8); }; addEventListener('scroll', onS, { passive: true }); onS(); }

  // Fade things in as they scroll into view
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else els.forEach(function (el) { el.classList.add('in'); });

  // Pixel stars, placed the same way every visit
  document.querySelectorAll('.stars').forEach(function (box, k) {
    var n = +box.getAttribute('data-n') || 26, seed = 7 + k * 101, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var cols = ['#9DB0EA', '#C9B8F0', '#F2C9A8', '#A9D4DE', '#E8D27A'];
    var html = '';
    for (var i = 0; i < n; i++) {
      var plus = rnd() < 0.18;
      var x = rnd() * 44; x = x < 22 ? x : x + 56;
      html += '<i class="star' + (plus ? ' plus' : '') + '" style="left:' + x.toFixed(2) + '%;top:' + (rnd() * 100).toFixed(2) + '%;--c:' + cols[i % cols.length] + ';--t:' + (3 + rnd() * 4).toFixed(1) + 's;--d:-' + (rnd() * 6).toFixed(1) + 's"></i>';
    }
    box.innerHTML = html;
  });

  // Moons that orbit the big planet on a tilted path, passing behind it
  var stage = document.querySelector('.stage');
  if (stage) {
    var moons = [].slice.call(stage.querySelectorAll('.moon'));
    var tilt = -18 * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
    var place = function (t) {
      var w = stage.clientWidth;
      moons.forEach(function (m) {
        var rx = +m.dataset.rx * w, ry = +m.dataset.ry * w, sp = +m.dataset.speed, a = +m.dataset.phase + t * sp;
        var x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        var X = x * ct - y * st, Y = x * st + y * ct;
        var front = Math.sin(a) > 0;
        m.style.transform = 'translate(' + X.toFixed(1) + 'px,' + Y.toFixed(1) + 'px) scale(' + (front ? 1 : 0.86) + ')';
        m.style.zIndex = front ? 3 : 1;
      });
    };
    if (reduce) place(0);
    else { var t0 = performance.now(); var loop = function (now) { place((now - t0) / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  }
})();
