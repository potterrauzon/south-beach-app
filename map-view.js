/* <map-view> — Leaflet + OpenStreetMap map of the trip places.
   Self-contained: loads Leaflet, fetches places.json, owns its container.
   API: setVisible(ids[]), refresh(), focus(id) */
(function () {
  "use strict";

  var CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var CSS_HASH = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";
  var JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  var JS_HASH = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";

  var ACCENT = { eat: "var(--teal, #0E7C7B)", drink: "var(--accent, #F2A007)", do: "var(--ink, #10243A)", ride: "var(--ride, #D64545)" };
  var loader = null;

  function loadLeaflet() {
    if (loader) return loader;
    loader = new Promise(function (resolve, reject) {
      if (window.L) return resolve(window.L);
      if (!document.querySelector('link[data-leaflet]')) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CSS_URL;
        link.integrity = CSS_HASH;
        link.crossOrigin = "anonymous";
        link.setAttribute("data-leaflet", "");
        document.head.appendChild(link);
      }
      var s = document.createElement("script");
      s.src = JS_URL;
      s.integrity = JS_HASH;
      s.crossOrigin = "anonymous";
      s.onload = function () { resolve(window.L); };
      s.onerror = function () { reject(new Error("Leaflet failed to load")); };
      document.head.appendChild(s);
    });
    return loader;
  }

  function styleOnce() {
    if (document.getElementById("map-view-style")) return;
    var st = document.createElement("style");
    st.id = "map-view-style";
    st.textContent = [
      "map-view { display: block; position: relative; width: 100%; height: 100%; background: var(--bg, #E6EFEC); }",
      "map-view .mv-canvas { position: absolute; inset: 0; }",
      "map-view .leaflet-tile-pane { filter: saturate(0.9) contrast(0.98) sepia(0.06); }",
      "map-view .leaflet-container { font-family: 'Public Sans', -apple-system, sans-serif; background: var(--bg, #E6EFEC); }",
      "map-view .leaflet-container .leaflet-control-attribution { font-size: 9px; background: var(--pillBg, rgba(251,250,246,0.82)); color: var(--attrFg, #52687D); }",
      "map-view .leaflet-control-attribution a { color: var(--teal, #0E7C7B); }",
      "map-view .leaflet-bar a { color: var(--ink, #10243A); border-radius: 0; }",
      "map-view .mv-pin { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid var(--card, #FBFAF6); box-shadow: 0 1px 4px var(--pinShadow, rgba(16,36,58,0.45)); transition: transform 0.28s cubic-bezier(0.22,1,0.36,1); }",
      "map-view .mv-pin.is-focus { transform: scale(1.45); }",
      "map-view .mv-base { width: 26px; height: 26px; border-radius: 50%; background: var(--accent, #F2A007); border: 3px solid var(--ink, #10243A); box-shadow: 0 0 0 4px var(--baseRing, rgba(242,160,7,0.28)); }",
      "map-view .leaflet-popup-content-wrapper { background: var(--card, #FBFAF6); color: var(--ink, #10243A); border-radius: var(--r, 3px); box-shadow: var(--popShadow, 0 8px 24px rgba(16,36,58,0.28)); }",
      "map-view .leaflet-popup-content { margin: 12px 14px; width: 194px !important; }",
      "map-view .leaflet-popup-tip { background: var(--card, #FBFAF6); }",
      "map-view .mv-cat { font-family: 'DM Mono', ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint, #93A5B4); }",
      "map-view .mv-name { font-family: Archivo, 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 15px; line-height: 1.15; margin: 3px 0 2px; }",
      "map-view .mv-sub { font-size: 12px; color: var(--muted, #52687D); }",
      "map-view .mv-walk { font-family: 'DM Mono', ui-monospace, Menlo, monospace; font-size: 11px; color: var(--ink, #10243A); margin-top: 6px; }",
      "map-view .mv-go { display: inline-block; margin-top: 9px; font-family: 'DM Mono', ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; color: var(--card, #FBFAF6) !important; background: var(--ink, #10243A); border-radius: var(--r, 3px); padding: 7px 11px; }",
      "map-view .mv-fail { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 30px; font-size: 13px; color: var(--muted, #52687D); }"
    ].join("\n");
    document.head.appendChild(st);
  }

  function travel(p) {
    if (p.drive) return p.drive + " min drive";
    if (p.walk === 0) return "Ride there";
    return p.walk + " min walk";
  }

  function directions(p) {
    if (p.lat && p.lng) {
      return "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng;
    }
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.name + " " + p.address);
  }

  function esc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  class MapView extends HTMLElement {
    connectedCallback() {
      if (this.booted) return;
      this.booted = true;
      styleOnce();
      this.canvas = document.createElement("div");
      this.canvas.className = "mv-canvas";
      this.appendChild(this.canvas);
      this.markers = {};
      this.pending = null;

      Promise.all([
        loadLeaflet(),
        fetch("places.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
      ]).then(this.build.bind(this)).catch(this.fail.bind(this));
    }

    disconnectedCallback() {
      if (this.ro) this.ro.disconnect();
    }

    fail() {
      var el = document.createElement("div");
      el.className = "mv-fail";
      el.textContent = "Map needs a connection the first time. Reopen once online and it stays cached.";
      this.appendChild(el);
    }

    build(res) {
      var L = res[0];
      var data = res[1];
      var base = data.base || { lat: 25.7845, lng: -80.1303, name: "Base" };
      var self = this;

      var map = L.map(this.canvas, {
        center: [base.lat, base.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
        tap: true
      });
      this.map = map;
      this.L = L;

      var tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
        detectRetina: true
      }).addTo(map);
      var swapped = false;
      tiles.on("tileerror", function () {
        if (swapped) return;
        swapped = true;
        map.removeLayer(tiles);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19
        }).addTo(map);
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      this.baseMarker = L.marker([base.lat, base.lng], {
        icon: L.divIcon({ className: "", html: '<div class="mv-base"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
        zIndexOffset: 1000
      }).addTo(map).bindPopup(
        '<div class="mv-cat">Base</div><div class="mv-name">' + esc(base.name) + "</div>" +
        '<div class="mv-sub">' + esc(base.address || "") + "</div>" +
        /* No origin param — Maps routes from the phone's current location. */
        '<a class="mv-go" href="https://www.google.com/maps/dir/?api=1&destination=' +
          base.lat + "," + base.lng + '&travelmode=walking" target="_blank" rel="noopener">' +
          "Directions to here</a>",
        { closeButton: false, offset: [0, 4] }
      );

      this.layer = L.layerGroup().addTo(map);

      data.places.forEach(function (p) {
        if (!p.lat || !p.lng) return;
        var color = ACCENT[p.category] || "var(--teal, #0E7C7B)";
        var cat = (data.categories.filter(function (c) { return c.id === p.category; })[0] || {}).label || p.category;
        var offBeach = !!p.drive;
        var m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: '<div class="mv-pin" style="background:' + color + '"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          }),
          title: p.name
        });
        m.bindPopup(
          '<div class="mv-cat">' + esc(cat) + "</div>" +
          '<div class="mv-name">' + esc(p.name) + "</div>" +
          '<div class="mv-sub">' + esc(p.address) + "</div>" +
          '<div class="mv-walk">' + esc(travel(p)) + "</div>" +
          '<a class="mv-go" href="' + esc(directions(p)) + '" target="_blank" rel="noopener">Directions</a>',
          { closeButton: false, offset: [0, 2] }
        );
        m.__offBeach = offBeach;
        self.markers[p.id] = m;
      });

      this.setVisible(this.pending || Object.keys(this.markers));

      var ro = new ResizeObserver(function () {
        self.map.invalidateSize();
        self.applyFit(false);
      });
      ro.observe(this);
      this.ro = ro;

      map.on("zoomstart dragstart", function () {
        if (!self.selfMove) self.suppressFit = true;
      });
      requestAnimationFrame(function () {
        self.map.invalidateSize();
        self.applyFit(false);
      });

      this.dispatchEvent(new CustomEvent("map-ready"));
    }

    setVisible(ids) {
      if (!this.map) { this.pending = ids; return; }
      var self = this;
      var L = this.L;
      this.suppressFit = false;
      var keep = {};
      (ids || []).forEach(function (id) { keep[id] = true; });
      this.layer.clearLayers();
      var pts = [];
      var near = [];
      Object.keys(this.markers).forEach(function (id) {
        if (!keep[id]) return;
        var m = self.markers[id];
        self.layer.addLayer(m);
        pts.push(m.getLatLng());
        if (!m.__offBeach) near.push(m.getLatLng());
      });
      /* Fit the walkable cluster — off-beach places (Wynwood) would zoom the
         whole beach into a handful of overlapping dots. */
      var fit = near.length ? near : pts;
      this.lastFit = fit.length ? L.latLngBounds(fit).pad(0.12) : null;
      this.applyFit(true);
    }

    /* Fit only counts once the container has a real size — the Map tab is
       hidden on first paint, so an early fit resolves against a stale box. */
    applyFit(animate) {
      if (!this.map || !this.lastFit || this.suppressFit) return;
      var size = this.map.getSize();
      if (!size.x || !size.y) return;
      this.selfMove = true;
      this.map.fitBounds(this.lastFit, { animate: !!animate, duration: 0.45, maxZoom: 16 });
      var self = this;
      clearTimeout(this.selfTimer);
      this.selfTimer = setTimeout(function () { self.selfMove = false; }, 700);
    }

    /* Return to the walkable cluster after a base/pin focus. */
    fitAll() {
      this.map.closePopup();
      this.suppressFit = false;
      this.applyFit(true);
    }

    /* Center the stay itself — the Base tab's whole job. */
    focusBase(open) {
      if (!this.baseMarker || !this.map) return;
      this.selfMove = true;
      this.suppressFit = true;
      this.map.setView(this.baseMarker.getLatLng(), 17, { animate: true });
      if (open) this.baseMarker.openPopup();
    }

    focus(id) {
      var m = this.markers[id];
      if (!m || !this.map) return;
      this.selfMove = true;
      this.suppressFit = true;
      this.map.setView(m.getLatLng(), 17, { animate: true });
      m.openPopup();
    }

    refresh() {
      if (!this.map) return;
      this.map.invalidateSize();
      var self = this;
      requestAnimationFrame(function () { self.applyFit(false); });
    }
  }

  if (!window.customElements.get("map-view")) {
    window.customElements.define("map-view", MapView);
  }
}());
