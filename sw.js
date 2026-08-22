/* South Beach — offline shell.
   Bump CACHE when any precached file changes; the old cache is dropped on activate. */
var CACHE = "sobe-v5";

/* Relative URLs so the worker works from a repo subpath on GitHub Pages. */
var SHELL = [
  "./",
  "index.html",
  "support.js",
  "map-view.js",
  "places.json",
  "palm-sky.jpg",
  "flamingo.png",
  "manifest.json",
  "icon.svg",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* Individual adds so one 404 can't fail the whole install. */
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  /* Navigations: serve the shell so a cold offline launch still boots. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match("index.html").then(function (r) {
          return r || caches.match("./");
        });
      })
    );
    return;
  }

  /* App files: cache first, revalidate in the background. */
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var live = fetch(req).then(function (res) {
          if (res && res.ok) {
            caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || live;
      })
    );
    return;
  }

  /* Fonts, Leaflet, map tiles: stale-while-revalidate, opaque responses included. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var live = fetch(req).then(function (res) {
        if (res) {
          caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});
