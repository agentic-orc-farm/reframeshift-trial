// Registers the service worker for the whole site, where the browser supports one.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('The service worker did not register:', error);
    });
  });
}
