const MANHATTAN_CENTER = [40.7831, -73.9712];
let map;
let requestLayer;

function requireLeaflet() {
  if (!window.L) throw new Error("Leaflet did not load.");
}

function initializeMap() {
  if (map) return;
  requireLeaflet();
  map = window.L.map("request-map", { scrollWheelZoom: false }).setView(MANHATTAN_CENTER, 11);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  requestLayer = window.L.layerGroup().addTo(map);
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
  addTextLine(popup, point.incident_address);
  if (point.created_date) {
    addTextLine(popup, formatSocrataDateTime(point.created_date));
  }
  addTextLine(popup, point.unique_key ? `Request ${point.unique_key}` : "");
  return popup;
}

export function renderMapPoints(points) {
  initializeMap();
  requestLayer.clearLayers();

  const bounds = [];
  points.forEach((point) => {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const location = [latitude, longitude];
    window.L.circleMarker(location, {
      radius: 5,
      color: "#ffffff",
      weight: 1,
      fillColor: "#3b6cf6",
      fillOpacity: 0.78,
    })
      .bindPopup(createPopup(point))
      .addTo(requestLayer);
    bounds.push(location);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  } else {
    map.setView(MANHATTAN_CENTER, 11);
  }

  window.setTimeout(() => map.invalidateSize(), 0);
  return bounds.length;
}
