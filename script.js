const fallingStar = document.querySelector('.falling-star-core');
const starTrail = document.querySelector('.star-trail path');
const trailSections = [...document.querySelectorAll('.hero, .intro-band, .work, .listen-band, .connect')];
const reveals = document.querySelectorAll('.reveal');
let currentRouteProgress = null;
let targetStar = null;
let motionFrame = null;

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

reveals.forEach((element) => revealObserver.observe(element));

function getTrailPoints() {
  const sectionOffsets = [0.75, 0.82, 0.16, 0.74, 0.22];
  return trailSections.map((section, index) => {
    const rect = section.getBoundingClientRect();
    const documentY = window.scrollY + rect.top + Math.min(rect.height * 0.24, 170);
    const y = documentY - window.scrollY;
    return { x: window.innerWidth * sectionOffsets[index], y };
  });
}

function smoothPath(points) {
  if (!points.length) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` Q ${midpointX} ${previous.y}, ${current.x} ${current.y}`;
  }
  return path;
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
  return { start, control, end, point: quadraticPoint(start, control, end, progress) };
}

function traveledPath(points, segment, progress, endpoint) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < segment; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    path += ` Q ${(start.x + end.x) / 2} ${start.y}, ${end.x} ${end.y}`;
  }
  const curve = activeCurve(points, segment, progress);
  const endPoint = endpoint || curve.point;
  path += ` Q ${curve.control.x} ${curve.control.y}, ${endPoint.x} ${endPoint.y}`;
  return path;
}

function moveFallingStar() {
  const points = getTrailPoints();
  const readingPosition = window.scrollY + window.innerHeight * 0.28;
  const anchorPositions = trailSections.map((section) => section.offsetTop + Math.min(section.offsetHeight * 0.24, 170));
  let segment = anchorPositions.findIndex((position, index) => index < anchorPositions.length - 1 && readingPosition < anchorPositions[index + 1]);
  segment = segment < 0 ? anchorPositions.length - 2 : segment;
  const segmentLength = anchorPositions[segment + 1] - anchorPositions[segment] || 1;
  const localProgress = Math.max(0, Math.min(1, (readingPosition - anchorPositions[segment]) / segmentLength));
  const curve = activeCurve(points, segment, localProgress);
  const { x, y } = curve.point;
  starTrail.parentElement.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  targetStar = { x, y, points, segment, localProgress, routeProgress: segment + localProgress };
  if (!motionFrame) motionFrame = requestAnimationFrame(animateFallingStar);
}

function animateFallingStar() {
  motionFrame = null;
  if (!targetStar) return;
  if (currentRouteProgress === null) currentRouteProgress = targetStar.routeProgress;
  currentRouteProgress += (targetStar.routeProgress - currentRouteProgress) * 0.14;
  const currentSegment = Math.min(targetStar.points.length - 2, Math.floor(currentRouteProgress));
  const currentProgress = currentRouteProgress - currentSegment;
  const currentCurve = activeCurve(targetStar.points, currentSegment, currentProgress);
  starTrail.setAttribute('d', traveledPath(targetStar.points, currentSegment, currentProgress));
  fallingStar.style.transform = `translate(${currentCurve.point.x - 5}px, ${currentCurve.point.y - 5}px)`;
  if (Math.abs(targetStar.routeProgress - currentRouteProgress) > 0.001) {
    motionFrame = requestAnimationFrame(animateFallingStar);
  }
}

window.addEventListener('scroll', moveFallingStar, { passive: true });
window.addEventListener('resize', moveFallingStar);
moveFallingStar();
