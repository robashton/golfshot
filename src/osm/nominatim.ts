export interface NominatimResult {
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

export async function searchGolfCourses(query: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query} golf`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Golfshot/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Nominatim search failed: ${res.status}`);
  }

  return (await res.json()) as NominatimResult[];
}
