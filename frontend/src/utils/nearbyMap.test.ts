import { describe, expect, it } from 'vitest';
import { nearbyEmbedUrl, nearbyMapsUrl, nearbyQuery } from './nearbyMap';

describe('nearbyMap', () => {
  it('searches ITP stations in the city, with spaces cleaned up', () => {
    expect(nearbyQuery('  Cluj   Napoca ')).toBe('stație ITP Cluj Napoca');
  });

  it('builds the embed and Maps links with the query encoded', () => {
    const embed = nearbyEmbedUrl('Brașov', 'k&y');
    expect(embed).toMatch(/^https:\/\/www\.google\.com\/maps\/embed\/v1\/search\?key=k%26y&q=/);
    expect(embed).toContain(encodeURIComponent('stație ITP Brașov'));
    expect(nearbyMapsUrl('Iași')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('stație ITP Iași')}`,
    );
  });
});
