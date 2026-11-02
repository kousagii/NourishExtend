// Apply the saved background before the app/fonts load. No account data is read.
(function () {
  var preference = 'system';
  try { preference = localStorage.getItem('nourish.appearance.v1') || 'system'; } catch (_) {}
  var dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.style.backgroundColor = dark ? '#211B17' : '#FAE6D0';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
