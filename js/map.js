const DEFAULT_CENTER = [40.7128, -74.006];
const NYC_BASEMAP_URL = "https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Basemap_v3/VectorTileServer";
let map;
let requestLayer;
let routeCenter = DEFAULT_CENTER;
let fallbackBasemap;

function requireLeaflet() {
  if (!window.L) throw new Error("Leaflet did not load.");
  if (!window.L.markerClusterGroup) throw new Error("Leaflet marker clustering did not load.");
}

function addOpenStreetMapFallback() {
  if (fallbackBasemap) return fallbackBasemap;
  fallbackBasemap = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return fallbackBasemap;
}

function addBasemap() {
  const vectorTiles = window.L.esri?.Vector?.vectorTileLayer;
  if (!vectorTiles) return addOpenStreetMapFallback();

  const layer = vectorTiles(NYC_BASEMAP_URL, {
    attribution: 'Basemap &copy; <a href="https://www.nyc.gov/site/oti/index.page">NYC OTI</a>',
  });
  let loaded = false;
  layer.on("load", () => {
    loaded = true;
  });
  layer.on("load-error", () => {
    if (loaded || fallbackBasemap) return;
    map.removeLayer(layer);
    addOpenStreetMapFallback();
  });
  layer.addTo(map);
  return layer;
}

function initializeMap() {
  if (map) return;
  requireLeaflet();
  map = window.L.map("request-map", { scrollWheelZoom: false, maxZoom: 17 }).setView(routeCenter, 11);
  addBasemap();
  requestLayer = window.L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }).addTo(map);
}

function createRequestIcon() {
  return window.L.divIcon({
    className: "request-marker-shell",
    html: '<span class="request-marker-dot" aria-hidden="true"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function addTextLine(container, text, className = "map-popup-detail") {
  if (!text) return;
  const line = document.createElement("p");
  line.className = className;
  line.textContent = text;
  container.append(line);
}

function formatSocrataDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

function createPopup(point) {
  const popup = document.createElement("div");
  addTextLine(popup, point.complaint_type || "311 service request", "map-popup-title");
  addTextLine(popup, point.descriptor);
  addTextLine(popup, [point.agency, point.status].filter(Boolean).join(" · "));
  addTextLine(popup, point.community_board);
  addTextLine(popup, point.incident_address);
  if (point.created_date) {
    addTextLine(popup, formatSocrataDateTime(point.created_date));
  }
  addTextLine(popup, point.unique_key ? `Request ${point.unique_key}` : "");
  addTextLine(popup, point.datasetLabel ? `Dataset: ${point.datasetLabel}` : "");
  return popup;
}

export function renderMapPoints(points, center = DEFAULT_CENTER) {
  routeCenter = center;
  initializeMap();
  requestLayer.clearLayers();

  const bounds = [];
  points.forEach((point) => {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const location = [latitude, longitude];
    window.L.marker(location, {
      alt: point.complaint_type || "311 service request",
      icon: createRequestIcon(),
    })
      .bindPopup(createPopup(point))
      .addTo(requestLayer);
    bounds.push(location);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  } else {
    map.setView(routeCenter, 11);
  }

  window.setTimeout(() => map.invalidateSize(), 0);
  return bounds.length;
}
