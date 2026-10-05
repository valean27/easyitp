// Mesajul manual (WhatsApp / SMS de pe telefon) cu cererea de recenzie
export function reviewMessage(name: string | null, station: string | null, url: string): string {
  const hello = name ? `Bună ziua, ${name}!` : 'Bună ziua!';
  const thanks = station ? `Vă mulțumim că ați ales ${station}.` : 'Vă mulțumim că ați ales stația noastră.';
  return `${hello} ${thanks} Dacă ați fost mulțumit, ne ajută mult o recenzie: ${url}`;
}
