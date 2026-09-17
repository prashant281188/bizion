/**
 * Generates a URL-friendly slug from string input.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters except dashes
    .replace(/\-\-+/g, '-') // Replace multiple dashes with a single dash
    .replace(/^-+/, '') // Trim dashes from the start
    .replace(/-+$/, ''); // Trim dashes from the end
}
