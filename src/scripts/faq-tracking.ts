/** Track FAQ open events via Umami analytics. */
document.querySelectorAll('.faq-item').forEach((el) => {
  el.addEventListener('toggle', () => {
    if ((el as HTMLDetailsElement).open) {
      const q = el.querySelector('summary')?.getAttribute('data-faq');
      window.umami?.track('faq_open', { question: q ?? '' });
    }
  });
});
