// ui/mode.js — runs before the page paints: the DIGI game view, unless this viewer chose the classic document (a
// preference remembered in this browser only) or followed a link into a section of it. With scripts off, the classic
// document is all there is, and it holds everything: what it is, how it works, the blueprint, the brochure, the paper.
(function () {
  var classic = ['top', 'what', 'worth', 'words', 'start', 'how', 'blueprint', 'business', 'cost', 'paper', 'faq'];
  var hash = (location.hash || '').slice(1), pick = null;
  try { pick = localStorage.getItem('digi-view'); } catch (e) { pick = null; }
  if (pick !== 'classic' && classic.indexOf(hash) < 0) document.documentElement.classList.add('game');
  try { var ui = localStorage.getItem('digi-ui'); if (ui === 'blockcraft') document.documentElement.setAttribute('data-ui', 'blockcraft'); } catch (e) { /* the default chrome */ }
})();
