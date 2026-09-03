/* ---------------------------------------------------------------------
   Falling star trail
   -----------------------------------------------------------------
   The star travels along a route with one anchor point per tracked
   section. Anchor Y values are stored in *document* space, so they
   only need to be re-measured on resize / layout changes — never on
   scroll. A point's on-screen position for any given scroll offset is
   then just arithmetic (anchorY - window.scrollY), so scrolling never
   triggers a forced layout read (getBoundingClientRect/offsetTop),
   which was the main source of jank.
------------------------------------------------------------------------ */

const fallingStar = document.querySelector('.falling-star-core');
const starSvg = document.querySelector('.star-trail');
const starTrail = document.querySelector('.star-trail path');
const trailSections = [...document.querySelectorAll('.hero, .intro-band, .work, .listen-band, .connect')];
const reveals = document.querySelectorAll('.reveal');

const SEGMENT_X_RATIOS = [0.75, 0.82, 0.16, 0.74, 0.22];
const HALF_LIFE_MS = 110;      // time to close half the remaining distance to target — tune to taste
const STOP_THRESHOLD = 0.0015; // how close is "close enough" before the animation loop stops
const STAR_HALF_SIZE = 14;     // .falling-star-core is 28px — offset by half so it's centered on the point

let anchorsY = [];
let anchorsX = [];
let currentRoute = null;
let targetRoute = 0;
let motionFrame = null;
let lastFrameTime = null;
let scrollQueued = false;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------- reveal-on-scroll fades (unchanged) ---------------- */

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

reveals.forEach((element) => revealObserver.observe(element));

/* ---------------------------- geometry ------------------------------- */

function measureRoute() {
  // Layout reads (offsetTop/offsetHeight) only ever happen here — on load,
  // resize, and font-load — never inside the scroll handler.
  anchorsY = trailSections.map((section) => section.offsetTop + Math.min(section.offsetHeight * 0.24, 170));
  anchorsX = SEGMENT_X_RATIOS.map((ratio) => window.innerWidth * ratio);
  starSvg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
}

function getViewportPoints() {
  // A section's viewport-relative position is just its document position
  // minus the current scroll offset — no DOM measurement needed.
  const scrollY = window.scrollY;
  return anchorsY.map((y, index) => ({ x: anchorsX[index], y: y - scrollY }));
}

function quadraticPoint(start, control, end, progress) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

function activeCurve(points, segment, progress) {
  const start = points[segment];
  const end = points[segment + 1];
  const control = { x: (start.x + end.x) / 2, y: start.y };
  return { control, point: quadraticPoint(start, control, end, progress) };
}

function traveledPath(points, segment, progress) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < segment; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    path += ` Q ${(start.x + end.x) / 2} ${start.y}, ${end.x} ${end.y}`;
  }
  const curve = activeCurve(points, segment, progress);
  path += ` Q ${curve.control.x} ${curve.control.y}, ${curve.point.x} ${curve.point.y}`;
  return path;
}

function routeProgressForScroll() {
  const readingPosition = window.scrollY + window.innerHeight * 0.28;
  let segment = anchorsY.findIndex((y, index) => index < anchorsY.length - 1 && readingPosition < anchorsY[index + 1]);
  if (segment < 0) segment = anchorsY.length - 2;
  const segmentLength = anchorsY[segment + 1] - anchorsY[segment] || 1;
  const localProgress = Math.min(1, Math.max(0, (readingPosition - anchorsY[segment]) / segmentLength));
  return segment + localProgress;
}

/* ------------------------------ render -------------------------------- */

function renderStarAt(route) {
  const points = getViewportPoints();
  const segment = Math.min(points.length - 2, Math.max(0, Math.floor(route)));
  const progress = route - segment;
  const curve = activeCurve(points, segment, progress);
  starTrail.setAttribute('d', traveledPath(points, segment, progress));
  fallingStar.style.transform = `translate(${curve.point.x - STAR_HALF_SIZE}px, ${curve.point.y - STAR_HALF_SIZE}px)`;
}

function animateFallingStar(now) {
  if (lastFrameTime === null) lastFrameTime = now;
  const deltaMs = now - lastFrameTime;
  lastFrameTime = now;

  // Frame-rate independent easing: closes the same proportion of the
  // remaining distance per unit of *time*, so the trail feels the same
  // on a 60Hz laptop and a 120Hz phone instead of one feeling laggier.
  const decay = Math.pow(0.5, deltaMs / HALF_LIFE_MS);
  currentRoute += (targetRoute - currentRoute) * (1 - decay);
  renderStarAt(currentRoute);

  if (Math.abs(targetRoute - currentRoute) > STOP_THRESHOLD) {
    motionFrame = requestAnimationFrame(animateFallingStar);
  } else {
    currentRoute = targetRoute;
    renderStarAt(currentRoute);
    motionFrame = null;
    lastFrameTime = null;
  }
}

function updateTarget() {
  targetRoute = routeProgressForScroll();

  if (currentRoute === null || reducedMotionQuery.matches) {
    currentRoute = targetRoute;
    renderStarAt(currentRoute);
    return;
  }

  if (!motionFrame) motionFrame = requestAnimationFrame(animateFallingStar);
}

/* ------------------------------ events --------------------------------- */

function onScroll() {
  // Collapse any number of scroll events that fire before the next paint
  // into a single update, instead of recalculating for every one of them.
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    updateTarget();
  });
}

function onLayoutChange() {
  measureRoute();
  updateTarget();
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onLayoutChange);
// Re-measure once everything (images, web fonts) has actually settled,
// since either can shift section heights after the first measurement.
window.addEventListener('load', onLayoutChange);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(onLayoutChange);
}
reducedMotionQuery.addEventListener('change', updateTarget);

measureRoute();
updateTarget();
