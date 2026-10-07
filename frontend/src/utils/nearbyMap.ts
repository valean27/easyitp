// "Caută stație ITP în zona ta" pe /statii: harta Google (Maps Embed API, gratuită) și link spre Google Maps.
// Căutarea o face browserul șoferului direct la Google; serverul nostru nu intră în calcul.

export const nearbyQuery = (city: string) => `stație ITP ${city.trim().replace(/\s+/g, ' ')}`;

// Harta încorporată; cheia e una de browser, restricționată la Maps Embed API și la domeniul nostru
export const nearbyEmbedUrl = (city: string, key: string) =>
  `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(key)}` +
  `&q=${encodeURIComponent(nearbyQuery(city))}&language=ro&region=RO`;

// Căutarea în Google Maps (fără cheie), în tab nou sau în aplicația Maps de pe telefon
export const nearbyMapsUrl = (city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearbyQuery(city))}`;
