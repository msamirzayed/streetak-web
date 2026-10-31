// Streetak's service worker (tools/web/site: published next to index.html by tools/web/push_pages.sh): the page opens offline once it has been
// played. Network first for the game's page (/, /index.html, the invite links /j/<code>), build.json and the loader,
// so a new build is always the one seen online (they are all `no-cache` on Cloudflare Pages); the last copy only when
// there's no network. The game's own files are kept by the page (Cache Storage, by their hashed names) and the content
// packs by Unity (IndexedDB); this worker leaves every other request alone (other pages, the parts' host).
var SHELL = "streetak-shell-v2";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return /^streetak-shell-/.test(k) && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var scope = new URL(self.registration.scope).pathname, path = url.pathname;
  var rel = path.indexOf(scope) === 0 ? path.slice(scope.length) : null;
  if (rel === null) return;
  var page = rel === "" || rel === "index.html" || /^[jf]\/[^\/]*\/?$/.test(rel);   // (room invites /j/, friend links /f/)
  var shell = page || rel === "build.json" || /^Build\/[^\/]+\.loader\.js$/.test(rel);
  if (!shell) return;
  // (every address of the page is one copy; the loader without its ?b= so the offline copy is the last one played)
  var key = page ? new URL(scope, url.origin).href : url.origin + path;
  e.respondWith(fetch(req).then(function (r) {
    // an invite link the host answered with a 404 (its /j/* rewrite missing): the game's page itself, which reads the
    // room's code from this address
    if (r && !r.ok && page && rel !== "" && rel !== "index.html") return fetch(new URL(scope, url.origin).href, { cache: "no-cache" });
    if (r && r.ok) { var copy = r.clone(); caches.open(SHELL).then(function (c) { return c.put(key, copy); }).catch(function () {}); }
    return r;
  }).catch(function () {
    return caches.open(SHELL).then(function (c) { return c.match(key); }).then(function (r) { return r || Response.error(); });
  }));
});
