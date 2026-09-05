(function () {
  try {
    const value = localStorage.getItem('theme');
    if (value === 'dark' || (!value && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
    // Same early restore for the Studio typeface (admin/typeface.mjs), so a
    // Mono/Pixel choice never flashes the Sans default on load.
    const face = localStorage.getItem('studio.typeface');
    if (face === 'mono' || face === 'pixel') document.documentElement.dataset.typeface = face;
  } catch (_) {}
})();
