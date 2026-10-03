// Tema aleasa (sau cea a sistemului) se aplica inainte de afisare, ca pagina sa nu clipeasca alb
(function () {
  var p = null;
  try { p = localStorage.getItem('easyitp_theme'); } catch (e) {}
  var dark = p === 'dark' || (p !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
