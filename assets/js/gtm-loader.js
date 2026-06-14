// Google tag (gtag.js) — Lazy-loaded for real users only
window.dataLayer = window.dataLayer || [];
window.gtag = function(){dataLayer.push(arguments);}

// Lazy-load Google Analytics/GTM only for real users on interaction or after 8s (blocking bots, local dev, and Lighthouse)
window.addEventListener('load', () => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
  const isBot = navigator.webdriver || /bot|googlebot|crawler|spider|robot|crawling|lighthouse|headless/i.test(navigator.userAgent);
  if (!isBot && !isLocal) {
    let gtmLoaded = false;
    function loadGTM() {
      if (gtmLoaded) return;
      gtmLoaded = true;
      
      window.removeEventListener('scroll', loadGTM);
      window.removeEventListener('click', loadGTM);
      window.removeEventListener('touchstart', loadGTM);
      window.removeEventListener('keydown', loadGTM);
      
      const script = document.createElement('script');
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=G-SXDJ560QTV";
      document.head.appendChild(script);

      window.gtag('js', new Date());
      window.gtag('config', 'G-SXDJ560QTV');
    }

    window.addEventListener('scroll', loadGTM, { passive: true });
    window.addEventListener('click', loadGTM, { passive: true });
    window.addEventListener('touchstart', loadGTM, { passive: true });
    window.addEventListener('keydown', loadGTM, { passive: true });

    setTimeout(loadGTM, 8000);
  }
});
