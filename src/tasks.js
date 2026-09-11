import './tasks.css';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Inertia scroll. Lenis owns it, so the native smooth behaviour must step aside.
const lenis = reduced ? null : new Lenis({ duration: 1.05, smoothWheel: true });
if (lenis) {
  document.documentElement.style.scrollBehavior = 'auto';
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

// Reveal each task once it is comfortably inside the viewport.
const tasks = [...document.querySelectorAll('.task')];
if (reduced) {
  tasks.forEach((t) => t.classList.add('is-on'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-on'); });
  }, { rootMargin: '-12% 0px -22% 0px' });
  tasks.forEach((t) => io.observe(t));
}

// Rail follows whichever stage covers the middle of the screen.
const rails = [...document.querySelectorAll('.rail a')];
const stages = [...document.querySelectorAll('.stage')];
const setRail = (n) => rails.forEach((a) => a.classList.toggle('on', a.dataset.rail === String(n)));
if (stages.length) {
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setRail(e.target.dataset.stage); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  stages.forEach((s) => io2.observe(s));
}

// Rail clicks go through Lenis so the inertia is not fought by native jumps.
rails.forEach((a) => a.addEventListener('click', (ev) => {
  const target = document.querySelector(a.getAttribute('href'));
  if (!target || !lenis) return;
  ev.preventDefault();
  lenis.scrollTo(target, { offset: -70 });
}));

// The counter under each sticky image reports which task the reader is on.
const stageBlocks = stages.map((s) => ({
  el: s,
  cur: s.querySelector('.stage-count .cur'),
  items: [...s.querySelectorAll('.task')],
}));
let ticking = false;
const railTotal = document.getElementById('rail-n');
const allTasks = tasks;
function updateCounters() {
  ticking = false;
  const line = innerHeight * 0.58;
  for (const b of stageBlocks) {
    if (!b.cur) continue;
    let n = 1;
    b.items.forEach((t, i) => { if (t.getBoundingClientRect().top < line) n = i + 1; });
    const next = String(n);
    if (b.cur.textContent !== next) b.cur.textContent = next;
  }
  // The card closest to the reading line is the one being read.
  let best = null, bestDist = Infinity;
  allTasks.forEach((t) => {
    const r = t.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const d = Math.abs(r.top + r.height / 2 - line);
    if (d < bestDist) { bestDist = d; best = t; }
  });
  allTasks.forEach((t) => t.classList.toggle('is-cur', t === best));
  if (railTotal && best) {
    const n = String(allTasks.indexOf(best) + 1);
    if (railTotal.textContent !== n) railTotal.textContent = n;
  }
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(updateCounters); } }
if (lenis) lenis.on('scroll', onScroll);
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
updateCounters();
