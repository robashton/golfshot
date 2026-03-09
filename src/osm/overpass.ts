import { logger } from "../logger.js";

export interface ParsedHole {
  number: number;
  par: number;
  yardage: number;
  tee?: { lat: number; lng: number };
  green?: { lat: number; lng: number };
  hazards?: Array<{ name: string; lat: number; lng: number }>;
}

export interface ParsedCourse {
  name: string;
  location: string;
  holes: ParsedHole[];
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function buildRelationQuery(osmId: number): string {
  return `[out:json][timeout:30];
rel(${osmId})->.course;
.course out geom;
.course >> ->.members;
nwr.members["golf"];
out geom;`;
}

function buildWayQuery(osmId: number): string {
  return `[out:json][timeout:30];
way(${osmId});
out geom;`;
}

function buildRadiusQuery(lat: number, lon: number): string {
  return `[out:json][timeout:30];
(
  nwr["golf"](around:1500,${lat},${lon});
  nwr["leisure"="golf_course"](around:1500,${lat},${lon});
);
out geom;`;
}

function centroid(geometry: Array<{ lat: number; lon: number }>): { lat: number; lng: number } {
  const sum = geometry.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }),
    { lat: 0, lon: 0 }
  );
  return { lat: sum.lat / geometry.length, lng: sum.lon / geometry.length };
}

function elementCentroid(el: OverpassElement): { lat: number; lng: number } | undefined {
  if (el.lat != null && el.lon != null) {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.geometry && el.geometry.length > 0) {
    return centroid(el.geometry);
  }
  if (el.bounds) {
    return {
      lat: (el.bounds.minlat + el.bounds.maxlat) / 2,
      lng: (el.bounds.minlon + el.bounds.maxlon) / 2,
    };
  }
  return undefined;
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function metersToYards(meters: number): number {
  return Math.round(meters * 1.09361);
}

export function parseOverpassResponse(
  data: OverpassResponse,
  fallbackName: string,
  fallbackLocation: string
): ParsedCourse {
  const elements = data.elements;

  // Find course element for name
  const courseElement = elements.find(
    (el) => el.tags?.leisure === "golf_course" && el.tags?.name
  );
  const name = courseElement?.tags?.name ?? fallbackName;

  // Extract holes from golf=hole ways
  const holeElements = elements.filter((el) => el.tags?.golf === "hole");
  const holes: ParsedHole[] = [];

  for (const el of holeElements) {
    const ref = parseInt(el.tags?.ref ?? "", 10);
    const par = parseInt(el.tags?.par ?? "", 10);
    const distTag = el.tags?.dist ?? el.tags?.distance ?? "";
    let yardage = parseInt(distTag, 10);

    // If dist looks like meters (typically > 100), convert
    if (!isNaN(yardage) && yardage > 0) {
      // OSM dist tag is usually in meters
      yardage = metersToYards(yardage);
    } else {
      yardage = 0;
    }

    const hole: ParsedHole = {
      number: isNaN(ref) ? 0 : ref,
      par: isNaN(par) ? 0 : par,
      yardage,
    };

    // Tee = first node, Green = last node of the hole way
    if (el.geometry && el.geometry.length >= 2) {
      const first = el.geometry[0];
      const last = el.geometry[el.geometry.length - 1];
      hole.tee = { lat: first.lat, lng: first.lon };
      hole.green = { lat: last.lat, lng: last.lon };
    }

    holes.push(hole);
  }

  // Match standalone tee/green elements to nearest holes
  const teeElements = elements.filter((el) => el.tags?.golf === "tee");
  const greenElements = elements.filter((el) => el.tags?.golf === "green");

  for (const teeEl of teeElements) {
    const pos = elementCentroid(teeEl);
    if (!pos || holes.length === 0) continue;

    // Match by ref tag first, then by proximity
    const ref = parseInt(teeEl.tags?.ref ?? "", 10);
    let matched = !isNaN(ref) ? holes.find((h) => h.number === ref) : undefined;

    if (!matched) {
      // Find nearest hole without a tee
      const candidates = holes.filter((h) => !h.tee);
      if (candidates.length > 0) {
        matched = candidates.reduce((best, h) => {
          const holePos = h.green ?? h.tee;
          if (!holePos) return best;
          const bestPos = best.green ?? best.tee;
          if (!bestPos) return h;
          return distance(pos, holePos) < distance(pos, bestPos) ? h : best;
        });
      }
    }

    if (matched && !matched.tee) {
      matched.tee = pos;
    }
  }

  for (const greenEl of greenElements) {
    const pos = elementCentroid(greenEl);
    if (!pos || holes.length === 0) continue;

    const ref = parseInt(greenEl.tags?.ref ?? "", 10);
    let matched = !isNaN(ref) ? holes.find((h) => h.number === ref) : undefined;

    if (!matched) {
      const candidates = holes.filter((h) => !h.green);
      if (candidates.length > 0) {
        matched = candidates.reduce((best, h) => {
          const holePos = h.tee ?? h.green;
          if (!holePos) return best;
          const bestPos = best.tee ?? best.green;
          if (!bestPos) return h;
          return distance(pos, holePos) < distance(pos, bestPos) ? h : best;
        });
      }
    }

    if (matched && !matched.green) {
      matched.green = pos;
    }
  }

  // Extract hazards and match to nearest hole
  const hazardElements = elements.filter(
    (el) => el.tags?.golf === "bunker" || el.tags?.golf === "water_hazard"
  );

  for (const hazEl of hazardElements) {
    const pos = elementCentroid(hazEl);
    if (!pos || holes.length === 0) continue;

    const hazardName = hazEl.tags?.name ?? hazEl.tags?.golf ?? "hazard";

    // Find nearest hole
    let nearest = holes[0];
    let minDist = Infinity;
    for (const h of holes) {
      const holeCenter = h.green ?? h.tee;
      if (!holeCenter) continue;
      const d = distance(pos, holeCenter);
      if (d < minDist) {
        minDist = d;
        nearest = h;
      }
    }

    if (!nearest.hazards) nearest.hazards = [];
    nearest.hazards.push({ name: hazardName, lat: pos.lat, lng: pos.lng });
  }

  // Sort holes by number
  holes.sort((a, b) => a.number - b.number);

  return { name, location: fallbackLocation, holes };
}

async function queryOverpass(query: string): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass query failed: ${res.status}`);
  }

  return (await res.json()) as OverpassResponse;
}

function findCentroidFromElements(elements: OverpassElement[]): { lat: number; lng: number } | undefined {
  for (const el of elements) {
    const c = elementCentroid(el);
    if (c) return c;
  }
  return undefined;
}

function hasGolfElements(data: OverpassResponse): boolean {
  return data.elements.some((el) => el.tags?.golf === "hole");
}

export async function fetchCourseData(
  osmType: string,
  osmId: number,
  fallbackName: string,
  fallbackLocation: string,
  fallbackLat?: number,
  fallbackLon?: number
): Promise<ParsedCourse> {
  // Nodes: always use radius query
  if (osmType === "node" && fallbackLat != null && fallbackLon != null) {
    const query = buildRadiusQuery(fallbackLat, fallbackLon);
    const data = await queryOverpass(query);
    return parseOverpassResponse(data, fallbackName, fallbackLocation);
  }

  // Relations: recurse into members to find golf elements
  if (osmType === "relation") {
    const query = buildRelationQuery(osmId);
    try {
      const data = await queryOverpass(query);
      if (hasGolfElements(data)) {
        return parseOverpassResponse(data, fallbackName, fallbackLocation);
      }
      // No golf children — fall back to radius query from relation centroid
      logger.info(`Relation ${osmId} has no golf children, falling back to radius query`);
      const center = findCentroidFromElements(data.elements) ??
        (fallbackLat != null && fallbackLon != null ? { lat: fallbackLat, lng: fallbackLon } : undefined);
      if (center) {
        const radiusData = await queryOverpass(buildRadiusQuery(center.lat, center.lng));
        return parseOverpassResponse(radiusData, fallbackName, fallbackLocation);
      }
    } catch (err) {
      logger.error(`Relation query failed for ${osmId}, falling back to radius`, err instanceof Error ? err.message : String(err));
      if (fallbackLat != null && fallbackLon != null) {
        const radiusData = await queryOverpass(buildRadiusQuery(fallbackLat, fallbackLon));
        return parseOverpassResponse(radiusData, fallbackName, fallbackLocation);
      }
    }
    throw new Error(`Could not fetch course data for relation/${osmId}`);
  }

  // Ways: fetch the way geometry, then use radius query from its centroid
  if (osmType === "way") {
    const wayQuery = buildWayQuery(osmId);
    try {
      const wayData = await queryOverpass(wayQuery);
      const center = findCentroidFromElements(wayData.elements);
      if (center) {
        const radiusData = await queryOverpass(buildRadiusQuery(center.lat, center.lng));
        return parseOverpassResponse(radiusData, fallbackName, fallbackLocation);
      }
    } catch (err) {
      logger.error(`Way query failed for ${osmId}, falling back`, err instanceof Error ? err.message : String(err));
    }
    // Fall back to provided coordinates
    if (fallbackLat != null && fallbackLon != null) {
      const radiusData = await queryOverpass(buildRadiusQuery(fallbackLat, fallbackLon));
      return parseOverpassResponse(radiusData, fallbackName, fallbackLocation);
    }
    throw new Error(`Could not fetch course data for way/${osmId}`);
  }

  throw new Error(`Unsupported OSM type: ${osmType}`);
}
