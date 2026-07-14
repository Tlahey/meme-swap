// Giphy client interface and implementation for meme-swap

export interface GiphyImage {
  url: string;
  width: string;
  height: string;
  size?: string;
  mp4?: string;
  webp?: string;
}

export interface GiphyGif {
  id: string;
  title: string;
  url: string;
  images: {
    original: GiphyImage;
    fixed_width: GiphyImage;
    fixed_height: GiphyImage;
    downsized?: GiphyImage;
  };
}

export interface GiphySearchOptions {
  query: string;
  limit?: number;
  offset?: number;
}

export interface GiphyTrendingOptions {
  limit?: number;
  offset?: number;
}

export interface GiphySearchResponse {
  data: GiphyGif[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

// Pre-curated high-quality, swap-friendly GIFs to fall back to
export const CURATED_FALLBACK_GIFS: GiphyGif[] = [
  {
    id: "YsTs5ltWtEhnq",
    title: "Superman (Christopher Reeve) flying",
    url: "https://giphy.com/gifs/superman-christopher-reeve-flying-YsTs5ltWtEhnq",
    images: {
      original: {
        url: "https://media.giphy.com/media/YsTs5ltWtEhnq/giphy.gif",
        width: "400",
        height: "259",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/YsTs5ltWtEhnq/giphy.gif",
        width: "200",
        height: "130",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/YsTs5ltWtEhnq/giphy.gif",
        width: "309",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/YsTs5ltWtEhnq/giphy.gif",
        width: "400",
        height: "259",
      }
    }
  },
  {
    id: "8Iv5lqKwKsZ2g",
    title: "Leonardo DiCaprio Gatsby toast",
    url: "https://giphy.com/gifs/filmeditor-leonardo-dicaprio-the-great-gatsby-8Iv5lqKwKsZ2g",
    images: {
      original: {
        url: "https://media.giphy.com/media/8Iv5lqKwKsZ2g/giphy.gif",
        width: "500",
        height: "281",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/8Iv5lqKwKsZ2g/giphy.gif",
        width: "200",
        height: "112",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/8Iv5lqKwKsZ2g/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/8Iv5lqKwKsZ2g/giphy.gif",
        width: "500",
        height: "281",
      }
    }
  },
  {
    id: "hyyV7pnbE0FqLNBAzs",
    title: "Michael Scott - No God Please No",
    url: "https://giphy.com/gifs/the-office-no-steve-carell-hyyV7pnbE0FqLNBAzs",
    images: {
      original: {
        url: "https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif",
        width: "480",
        height: "360",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif",
        width: "200",
        height: "150",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif",
        width: "267",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif",
        width: "480",
        height: "360",
      }
    }
  },
  {
    id: "111ebonMs90YLu",
    title: "Kid at computer giving thumbs up",
    url: "https://giphy.com/gifs/thumbs-up-computer-kid-111ebonMs90YLu",
    images: {
      original: {
        url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
        width: "260",
        height: "195",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
        width: "200",
        height: "150",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
        width: "267",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
        width: "260",
        height: "195",
      }
    }
  },
  {
    id: "26ufdipQqU2lhNA4g",
    title: "Mind blown - head exploding into galaxy",
    url: "https://giphy.com/gifs/mind-blown-26ufdipQqU2lhNA4g",
    images: {
      original: {
        url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        width: "200",
        height: "200",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        width: "200",
        height: "200",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        width: "200",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        width: "200",
        height: "200",
      }
    }
  },
  {
    id: "l0MYt5jPR6QX5pnqM",
    title: "The Office crew celebration dance",
    url: "https://giphy.com/gifs/the-office-dancing-celebration-l0MYt5jPR6QX5pnqM",
    images: {
      original: {
        url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        width: "370",
        height: "208",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        width: "200",
        height: "112",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        width: "370",
        height: "208",
      }
    }
  },
  {
    id: "d2Z9QYzA2aidiWn6",
    title: "Awesome! Thumbs up (Bobby Moynihan)",
    url: "https://giphy.com/gifs/awesome-thumbs-up-d2Z9QYzA2aidiWn6",
    images: {
      original: {
        url: "https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif",
        width: "356",
        height: "200",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif",
        width: "200",
        height: "112",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif",
        width: "356",
        height: "200",
      }
    }
  },
  {
    id: "xT9IgG50Fb7Mi0prBC",
    title: "Forrest Gump waving from shrimp boat",
    url: "https://giphy.com/gifs/forrest-gump-waving-xT9IgG50Fb7Mi0prBC",
    images: {
      original: {
        url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
        width: "400",
        height: "200",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
        width: "200",
        height: "100",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
        width: "400",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
        width: "400",
        height: "200",
      }
    }
  }
];

class GiphyClient {
  private getApiKey(): string | null {
    // Check localStorage first (in browser context)
    if (typeof window !== "undefined" && window.localStorage) {
      const key = window.localStorage.getItem("giphy_api_key");
      if (key && key.trim().length > 0) {
        return key.trim();
      }
    }
    // Fall back to server process env (if server side)
    if (typeof process !== "undefined" && process.env && process.env.GIPHY_API_KEY) {
      return process.env.GIPHY_API_KEY;
    }
    return null;
  }

  private getMockResponse(query?: string): GiphySearchResponse {
    let list = CURATED_FALLBACK_GIFS;
    if (query && query.trim().length > 0) {
      const cleanQ = query.toLowerCase();
      list = CURATED_FALLBACK_GIFS.filter(g =>
        g.title.toLowerCase().includes(cleanQ) ||
        g.id.toLowerCase().includes(cleanQ)
      );
      // If no exact match, return everything so the UI doesn't look empty
      if (list.length === 0) {
        list = CURATED_FALLBACK_GIFS;
      }
    }
    return {
      data: list,
      pagination: {
        total_count: list.length,
        count: list.length,
        offset: 0
      }
    };
  }

  async search(options: GiphySearchOptions): Promise<GiphySearchResponse> {
    const key = this.getApiKey();

    // 1. Browser context checks
    if (typeof window !== "undefined") {
      // If we have a local key set in localStorage, call Giphy directly
      const localKey = window.localStorage.getItem("giphy_api_key");
      if (localKey && localKey.trim().length > 0) {
        return this.fetchFromGiphyApi("search", {
          api_key: localKey.trim(),
          q: options.query,
          limit: String(options.limit || 8),
          offset: String(options.offset || 0),
          rating: "g"
        });
      }

      // Check if running in Electron
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && typeof electronAPI.searchGiphy === "function") {
        try {
          return await electronAPI.searchGiphy(options);
        } catch (e) {
          console.warn("Electron Giphy search failed, falling back to mock:", e);
          return this.getMockResponse(options.query);
        }
      }

      // Web mode - Call Next.js API route proxy
      try {
        const url = `/api/giphy/search?q=${encodeURIComponent(options.query)}&limit=${options.limit || 8}&offset=${options.offset || 0}`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn("Giphy proxy search failed, falling back to mock:", e);
      }
      return this.getMockResponse(options.query);
    }

    // 2. Node/Server context check
    if (key) {
      return this.fetchFromGiphyApi("search", {
        api_key: key,
        q: options.query,
        limit: String(options.limit || 8),
        offset: String(options.offset || 0),
        rating: "g"
      });
    }

    return this.getMockResponse(options.query);
  }

  async trending(options: GiphyTrendingOptions = {}): Promise<GiphySearchResponse> {
    const key = this.getApiKey();

    // 1. Browser context checks
    if (typeof window !== "undefined") {
      // Local key direct fetch
      const localKey = window.localStorage.getItem("giphy_api_key");
      if (localKey && localKey.trim().length > 0) {
        return this.fetchFromGiphyApi("trending", {
          api_key: localKey.trim(),
          limit: String(options.limit || 8),
          offset: String(options.offset || 0),
          rating: "g"
        });
      }

      // Electron context
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && typeof electronAPI.getTrendingGiphy === "function") {
        try {
          return await electronAPI.getTrendingGiphy(options);
        } catch (e) {
          console.warn("Electron Giphy trending failed, falling back to mock:", e);
          return this.getMockResponse();
        }
      }

      // Web mode - Next.js API route
      try {
        const url = `/api/giphy/trending?limit=${options.limit || 8}&offset=${options.offset || 0}`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn("Giphy proxy trending failed, falling back to mock:", e);
      }
      return this.getMockResponse();
    }

    // 2. Node/Server context check
    if (key) {
      return this.fetchFromGiphyApi("trending", {
        api_key: key,
        limit: String(options.limit || 8),
        offset: String(options.offset || 0),
        rating: "g"
      });
    }

    return this.getMockResponse();
  }

  private async fetchFromGiphyApi(endpoint: "search" | "trending", params: Record<string, string>): Promise<GiphySearchResponse> {
    const queryParams = new URLSearchParams(params).toString();
    const url = `https://api.giphy.com/v1/gifs/${endpoint}?${queryParams}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Giphy API responded with status ${res.status}`);
    }
    return await res.json();
  }
}

export const giphy = new GiphyClient();
