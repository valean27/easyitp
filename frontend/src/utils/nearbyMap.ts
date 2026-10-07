// "Caută stație ITP în zona ta" pe /statii: căutarea în Google Maps, făcută de browserul șoferului (gratuit, fără cheie).

export const nearbyQuery = (city: string) => `stație ITP ${city.trim().replace(/\s+/g, ' ')}`;

// Se deschide în tab nou sau în aplicația Maps de pe telefon
export const nearbyMapsUrl = (city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearbyQuery(city))}`;
