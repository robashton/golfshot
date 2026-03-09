/* eslint-disable no-undef */
/**
 * Golfshot Map Editor — Leaflet-based satellite map for editing hole geometry.
 *
 * Usage:
 *   MapEditor.init(containerEl, formEl, existingGeometry?)
 *
 * The editor writes hidden <input> fields into `formEl` matching the names
 * expected by buildGeometryFromBody: tee_lat, tee_lng, green_lat, green_lng,
 * hazard_name_N/hazard_lat_N/hazard_lng_N, layup_name_N/layup_lat_N/layup_lng_N,
 * fairway_lat_N/fairway_lng_N.
 */
(function () {
  "use strict";

  var DEFAULT_CENTER = [55.86, -4.25]; // Glasgow area
  var DEFAULT_ZOOM = 16;
  var ESRI_TILES =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  var MODES = {
    PAN: "pan",
    TEE: "tee",
    GREEN: "green",
    HAZARD: "hazard",
    LAYUP: "layup",
    FAIRWAY: "fairway",
  };

  var COLORS = {
    tee: "#22cc44",
    green: "#cc2222",
    hazard: "#ddaa00",
    layup: "#3388ff",
    fairway: "#ff66ff",
  };

  function MapEditorInstance(containerEl, formEl, geometry) {
    this.formEl = formEl;
    this.mode = MODES.PAN;

    // State
    this.teeMarker = null;
    this.greenMarker = null;
    this.hazards = []; // { marker, label, name }
    this.layups = []; // { marker, label, name }
    this.fairwayPoints = []; // { marker }
    this.fairwayLine = null;

    this._buildUI(containerEl);
    this._initMap(geometry);
    this._loadGeometry(geometry);
    this._syncFormFields();
  }

  MapEditorInstance.prototype._buildUI = function (containerEl) {
    containerEl.innerHTML = "";

    var toolbar = document.createElement("div");
    toolbar.id = "map-editor-toolbar";

    var self = this;
    var buttons = [
      { mode: MODES.PAN, label: "Pan" },
      { mode: MODES.TEE, label: "Tee" },
      { mode: MODES.GREEN, label: "Green" },
      { mode: MODES.HAZARD, label: "+ Hazard" },
      { mode: MODES.LAYUP, label: "+ Layup" },
      { mode: MODES.FAIRWAY, label: "+ Fairway Pt" },
    ];

    this._buttons = {};
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.addEventListener("click", function () {
        self._setMode(b.mode);
      });
      toolbar.appendChild(btn);
      self._buttons[b.mode] = btn;
    });

    containerEl.appendChild(toolbar);

    var mapDiv = document.createElement("div");
    mapDiv.id = "map-editor-map";
    containerEl.appendChild(mapDiv);

    var status = document.createElement("div");
    status.className = "map-editor-status";
    containerEl.appendChild(status);
    this._statusEl = status;

    this._mapDiv = mapDiv;
    this._setMode(MODES.PAN);
  };

  MapEditorInstance.prototype._initMap = function (geometry) {
    var center = DEFAULT_CENTER;
    var zoom = DEFAULT_ZOOM;

    // Center on existing geometry if available
    if (geometry) {
      if (geometry.tee) {
        center = [geometry.tee.lat, geometry.tee.lng];
      } else if (geometry.green) {
        center = [geometry.green.lat, geometry.green.lng];
      } else if (geometry.hazards && geometry.hazards.length > 0) {
        center = [geometry.hazards[0].lat, geometry.hazards[0].lng];
      }
    }

    this.map = L.map(this._mapDiv, {
      center: center,
      zoom: zoom,
    });

    L.tileLayer(ESRI_TILES, {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    }).addTo(this.map);

    var self = this;
    this.map.on("click", function (e) {
      self._onMapClick(e);
    });
  };

  MapEditorInstance.prototype._loadGeometry = function (geo) {
    if (!geo) return;

    if (geo.tee) {
      this.teeMarker = this._createMarker(
        [geo.tee.lat, geo.tee.lng],
        COLORS.tee,
        "Tee"
      );
    }

    if (geo.green) {
      this.greenMarker = this._createMarker(
        [geo.green.lat, geo.green.lng],
        COLORS.green,
        "Green"
      );
    }

    var self = this;
    if (geo.hazards) {
      geo.hazards.forEach(function (h) {
        self._addHazard([h.lat, h.lng], h.name);
      });
    }

    if (geo.layups) {
      geo.layups.forEach(function (l) {
        self._addLayup([l.lat, l.lng], l.name);
      });
    }

    if (geo.fairway_points) {
      geo.fairway_points.forEach(function (p) {
        self._addFairwayPoint([p.lat, p.lng]);
      });
    }
  };

  MapEditorInstance.prototype._createMarker = function (
    latlng,
    color,
    tooltip
  ) {
    var marker = L.circleMarker(latlng, {
      radius: 8,
      fillColor: color,
      color: "#fff",
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(this.map);

    if (tooltip) {
      marker.bindTooltip(tooltip, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "map-editor-marker-label",
      });
    }

    // Make draggable
    marker.options.draggable = true;
    this._makeDraggable(marker);

    return marker;
  };

  MapEditorInstance.prototype._makeDraggable = function (marker) {
    var self = this;
    var dragging = false;
    var mapDragging;

    marker.on("mousedown", function (e) {
      dragging = true;
      mapDragging = self.map.dragging.enabled();
      self.map.dragging.disable();
      L.DomEvent.stopPropagation(e);

      function onMove(ev) {
        if (dragging) {
          marker.setLatLng(ev.latlng);
        }
      }

      function onUp() {
        dragging = false;
        self.map.off("mousemove", onMove);
        self.map.off("mouseup", onUp);
        if (mapDragging) self.map.dragging.enable();
        self._updateFairwayLine();
        self._syncFormFields();
      }

      self.map.on("mousemove", onMove);
      self.map.on("mouseup", onUp);
    });
  };

  MapEditorInstance.prototype._setMode = function (mode) {
    this.mode = mode;
    var descriptions = {
      pan: "Click and drag to pan the map",
      tee: "Click the map to place the tee marker",
      green: "Click the map to place the green marker",
      hazard: "Click the map to add a hazard marker",
      layup: "Click the map to add a layup marker",
      fairway: "Click the map to add fairway outline points",
    };
    this._statusEl.textContent = descriptions[mode] || "";

    // Update button states
    for (var key in this._buttons) {
      if (key === mode) {
        this._buttons[key].classList.add("active");
      } else {
        this._buttons[key].classList.remove("active");
      }
    }

    // Change cursor
    if (mode === MODES.PAN) {
      this._mapDiv.style.cursor = "";
    } else {
      this._mapDiv.style.cursor = "crosshair";
    }
  };

  MapEditorInstance.prototype._onMapClick = function (e) {
    var latlng = e.latlng;

    switch (this.mode) {
      case MODES.TEE:
        if (this.teeMarker) {
          this.map.removeLayer(this.teeMarker);
          if (this.teeMarker.getTooltip())
            this.map.removeLayer(this.teeMarker.getTooltip());
        }
        this.teeMarker = this._createMarker(
          [latlng.lat, latlng.lng],
          COLORS.tee,
          "Tee"
        );
        this._setMode(MODES.PAN);
        break;

      case MODES.GREEN:
        if (this.greenMarker) {
          this.map.removeLayer(this.greenMarker);
          if (this.greenMarker.getTooltip())
            this.map.removeLayer(this.greenMarker.getTooltip());
        }
        this.greenMarker = this._createMarker(
          [latlng.lat, latlng.lng],
          COLORS.green,
          "Green"
        );
        this._setMode(MODES.PAN);
        break;

      case MODES.HAZARD: {
        var hazardName = prompt("Hazard name:", "Hazard " + (this.hazards.length + 1));
        if (hazardName === null) return;
        this._addHazard([latlng.lat, latlng.lng], hazardName || "Hazard");
        break;
      }

      case MODES.LAYUP: {
        var layupName = prompt("Layup name:", "Layup " + (this.layups.length + 1));
        if (layupName === null) return;
        this._addLayup([latlng.lat, latlng.lng], layupName || "Layup");
        break;
      }

      case MODES.FAIRWAY:
        this._addFairwayPoint([latlng.lat, latlng.lng]);
        break;

      default:
        return;
    }

    this._syncFormFields();
  };

  MapEditorInstance.prototype._addHazard = function (latlng, name) {
    var marker = this._createMarker(latlng, COLORS.hazard, name);
    var entry = { marker: marker, name: name };

    var self = this;
    marker.on("contextmenu", function (e) {
      L.DomEvent.stopPropagation(e);
      self._showMarkerMenu(entry, "hazard");
    });

    this.hazards.push(entry);
  };

  MapEditorInstance.prototype._addLayup = function (latlng, name) {
    var marker = this._createMarker(latlng, COLORS.layup, name);
    var entry = { marker: marker, name: name };

    var self = this;
    marker.on("contextmenu", function (e) {
      L.DomEvent.stopPropagation(e);
      self._showMarkerMenu(entry, "layup");
    });

    this.layups.push(entry);
  };

  MapEditorInstance.prototype._showMarkerMenu = function (entry, type) {
    var action = prompt(
      type + ' "' + entry.name + '"\nType new name to rename, or "delete" to remove:',
      entry.name
    );
    if (action === null) return;

    if (action.toLowerCase() === "delete") {
      this.map.removeLayer(entry.marker);
      if (entry.marker.getTooltip())
        this.map.removeLayer(entry.marker.getTooltip());
      var list = type === "hazard" ? this.hazards : this.layups;
      var idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
    } else {
      entry.name = action;
      entry.marker.unbindTooltip();
      entry.marker.bindTooltip(action, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "map-editor-marker-label",
      });
    }

    this._syncFormFields();
  };

  MapEditorInstance.prototype._addFairwayPoint = function (latlng) {
    var marker = this._createMarker(latlng, COLORS.fairway, null);
    marker.setRadius(5);
    var entry = { marker: marker };

    var self = this;
    marker.on("contextmenu", function (e) {
      L.DomEvent.stopPropagation(e);
      if (confirm("Delete this fairway point?")) {
        self.map.removeLayer(marker);
        var idx = self.fairwayPoints.indexOf(entry);
        if (idx !== -1) self.fairwayPoints.splice(idx, 1);
        self._updateFairwayLine();
        self._syncFormFields();
      }
    });

    this.fairwayPoints.push(entry);
    this._updateFairwayLine();
  };

  MapEditorInstance.prototype._updateFairwayLine = function () {
    if (this.fairwayLine) {
      this.map.removeLayer(this.fairwayLine);
      this.fairwayLine = null;
    }

    if (this.fairwayPoints.length < 2) return;

    var latlngs = this.fairwayPoints.map(function (fp) {
      return fp.marker.getLatLng();
    });

    this.fairwayLine = L.polyline(latlngs, {
      color: COLORS.fairway,
      weight: 2,
      opacity: 0.7,
      dashArray: "6,4",
    }).addTo(this.map);
  };

  MapEditorInstance.prototype._syncFormFields = function () {
    // Remove old hidden fields
    var old = this.formEl.querySelectorAll("input.map-editor-field");
    for (var i = 0; i < old.length; i++) {
      old[i].parentNode.removeChild(old[i]);
    }

    var self = this;
    function addField(name, value) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      input.className = "map-editor-field";
      self.formEl.appendChild(input);
    }

    // Tee
    if (this.teeMarker) {
      var teeLL = this.teeMarker.getLatLng();
      addField("tee_lat", teeLL.lat);
      addField("tee_lng", teeLL.lng);
    }

    // Green
    if (this.greenMarker) {
      var greenLL = this.greenMarker.getLatLng();
      addField("green_lat", greenLL.lat);
      addField("green_lng", greenLL.lng);
    }

    // Hazards
    this.hazards.forEach(function (h, idx) {
      var ll = h.marker.getLatLng();
      addField("hazard_name_" + idx, h.name);
      addField("hazard_lat_" + idx, ll.lat);
      addField("hazard_lng_" + idx, ll.lng);
    });

    // Layups
    this.layups.forEach(function (l, idx) {
      var ll = l.marker.getLatLng();
      addField("layup_name_" + idx, l.name);
      addField("layup_lat_" + idx, ll.lat);
      addField("layup_lng_" + idx, ll.lng);
    });

    // Fairway points
    this.fairwayPoints.forEach(function (fp, idx) {
      var ll = fp.marker.getLatLng();
      addField("fairway_lat_" + idx, ll.lat);
      addField("fairway_lng_" + idx, ll.lng);
    });
  };

  // Public API
  window.MapEditor = {
    init: function (containerEl, formEl, geometry) {
      return new MapEditorInstance(containerEl, formEl, geometry || null);
    },
  };
})();
