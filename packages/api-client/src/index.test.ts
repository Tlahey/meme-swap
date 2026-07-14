import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { giphy, CURATED_FALLBACK_GIFS } from './index';

// This suite runs in Vitest's default Node environment (no `window`/DOM), so
// it exercises GiphyClient's server/Node-context code paths only: getApiKey()
// falling through to process.env.GIPHY_API_KEY, and search()/trending()'s
// "no window" branch (real API call when a key is configured, mock fallback
// otherwise). Setting up jsdom just to cover the browser-context branches
// (localStorage key, Electron IPC bridge, Next.js proxy route fetch) for this
// one file would be disproportionate to what those branches actually do —
// they're thin dispatches to the same fetch/mock logic already covered here.
describe('GiphyClient (Node/server context — no window)', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GIPHY_API_KEY;

  beforeEach(() => {
    delete process.env.GIPHY_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.GIPHY_API_KEY;
    } else {
      process.env.GIPHY_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  describe('without GIPHY_API_KEY configured', () => {
    it('search() falls back to the curated mock list when nothing matches the query', async () => {
      const result = await giphy.search({ query: 'anything' });
      expect(result.data).toEqual(CURATED_FALLBACK_GIFS);
      expect(result.pagination.total_count).toBe(CURATED_FALLBACK_GIFS.length);
      expect(result.pagination.offset).toBe(0);
    });

    it('search() filters the curated list case-insensitively by title/id when there is a match', async () => {
      const result = await giphy.search({ query: 'GATSBY' });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.length).toBeLessThan(CURATED_FALLBACK_GIFS.length);
      expect(
        result.data.every(
          (g) => g.title.toLowerCase().includes('gatsby') || g.id.toLowerCase().includes('gatsby'),
        ),
      ).toBe(true);
    });

    it('trending() falls back to the full curated list', async () => {
      const result = await giphy.trending();
      expect(result.data).toEqual(CURATED_FALLBACK_GIFS);
      expect(result.pagination.count).toBe(CURATED_FALLBACK_GIFS.length);
    });

    it('trending() respects an explicit limit/offset in the mock pagination shape (mock ignores them, always returns the full list)', async () => {
      const result = await giphy.trending({ limit: 3, offset: 6 });
      // getMockResponse() doesn't actually paginate — it always returns the
      // full curated list regardless of limit/offset, since there's no real
      // "next page" of curated data to page through.
      expect(result.data).toEqual(CURATED_FALLBACK_GIFS);
      expect(result.pagination.offset).toBe(0);
    });
  });

  describe('with GIPHY_API_KEY configured (server-side env var)', () => {
    beforeEach(() => {
      process.env.GIPHY_API_KEY = 'test-key-123';
    });

    it('search() calls the real Giphy API with the server-side key and query params', async () => {
      const mockResponse = { data: [], pagination: { total_count: 0, count: 0, offset: 0 } };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await giphy.search({ query: 'homer', limit: 5, offset: 10 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('https://api.giphy.com/v1/gifs/search');
      expect(calledUrl).toContain('api_key=test-key-123');
      expect(calledUrl).toContain('q=homer');
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('offset=10');
      expect(result).toEqual(mockResponse);
    });

    it('trending() throws a descriptive error when the Giphy API responds with a non-ok status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(giphy.trending()).rejects.toThrow('Giphy API responded with status 503');
    });
  });
});
