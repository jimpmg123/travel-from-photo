/**
 * Display helper for CLIP tag slugs.
 *
 * Slugs in the DB look like "plate_of_food_close-up" or "a_quiet_peaceful_scene"
 * — readable for storage but ugly in a UI chip. We just swap underscores for
 * spaces and trim leading filler ("a ", "an ") so the chip reads naturally.
 * Storage form (slug) is unchanged; this is render-only.
 */
export function humanizeTag(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/^a\s+/, '').replace(/^an\s+/, '').trim()
}
