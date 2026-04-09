export type PaginationItem = number | 'ellipsis';

/**
 * Up to 5 consecutive page numbers (window follows current page), then an ellipsis
 * and the last page when the last page is outside that window.
 */
export function buildPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const windowSize = 5;
  const start = Math.min(Math.max(1, current - 2), total - windowSize + 1);
  const window = Array.from({ length: windowSize }, (_, i) => start + i);
  const lastInWindow = window[windowSize - 1] ?? 0;
  if (lastInWindow >= total) {
    return window.filter((p) => p <= total);
  }
  return [...window, 'ellipsis', total];
}
