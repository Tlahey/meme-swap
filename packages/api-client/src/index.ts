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
    id: "COYGe9rVvfjlS",
    title: "Homer Simpson backing into bushes",
    url: "https://giphy.com/gifs/homer-simpson-the-simpsons-bush-COYGe9rVvfjlS",
    images: {
      original: {
        url: "https://media.giphy.com/media/COYGe9rVvfjlS/giphy.gif",
        width: "480",
        height: "360",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/COYGe9rVvfjlS/giphy.gif",
        width: "200",
        height: "150",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/COYGe9rVvfjlS/giphy.gif",
        width: "267",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/COYGe9rVvfjlS/giphy.gif",
        width: "480",
        height: "360",
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
    id: "l46Csb29cQlaBSJqM",
    title: "Drake Hotline Bling",
    url: "https://giphy.com/gifs/drake-hotline-bling-l46Csb29cQlaBSJqM",
    images: {
      original: {
        url: "https://media.giphy.com/media/l46Csb29cQlaBSJqM/giphy.gif",
        width: "480",
        height: "270",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/l46Csb29cQlaBSJqM/giphy.gif",
        width: "200",
        height: "113",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/l46Csb29cQlaBSJqM/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/l46Csb29cQlaBSJqM/giphy.gif",
        width: "480",
        height: "270",
      }
    }
  },
  {
    id: "12NUbkX6p4xOO4",
    title: "Jim Carrey laughing and pointing",
    url: "https://giphy.com/gifs/yes-jim-carrey-liar-12NUbkX6p4xOO4",
    images: {
      original: {
        url: "https://media.giphy.com/media/12NUbkX6p4xOO4/giphy.gif",
        width: "318",
        height: "244",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/12NUbkX6p4xOO4/giphy.gif",
        width: "200",
        height: "153",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/12NUbkX6p4xOO4/giphy.gif",
        width: "261",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/12NUbkX6p4xOO4/giphy.gif",
        width: "318",
        height: "244",
      }
    }
  },
  {
    id: "l36kU80xPf0ojG0Lm",
    title: "Spider-Man pointing at Spider-Man",
    url: "https://giphy.com/gifs/spiderman-pointing-l36kU80xPf0ojG0Lm",
    images: {
      original: {
        url: "https://media.giphy.com/media/l36kU80xPf0ojG0Lm/giphy.gif",
        width: "480",
        height: "270",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/l36kU80xPf0ojG0Lm/giphy.gif",
        width: "200",
        height: "113",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/l36kU80xPf0ojG0Lm/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/l36kU80xPf0ojG0Lm/giphy.gif",
        width: "480",
        height: "270",
      }
    }
  },
  {
    id: "p8G37Llh016p2",
    title: "Barbie waving in the car",
    url: "https://giphy.com/gifs/barbie-margot-robbie-p8G37Llh016p2",
    images: {
      original: {
        url: "https://media.giphy.com/media/p8G37Llh016p2/giphy.gif",
        width: "480",
        height: "270",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/p8G37Llh016p2/giphy.gif",
        width: "200",
        height: "113",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/p8G37Llh016p2/giphy.gif",
        width: "356",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/p8G37Llh016p2/giphy.gif",
        width: "480",
        height: "270",
      }
    }
  },
  {
    id: "3o7aD2saalFrAlzvn2",
    title: "Distracted Boyfriend looking back",
    url: "https://giphy.com/gifs/boyfriend-distracted-stock-photo-3o7aD2saalFrAlzvn2",
    images: {
      original: {
        url: "https://media.giphy.com/media/3o7aD2saalFrAlzvn2/giphy.gif",
        width: "480",
        height: "320",
      },
      fixed_width: {
        url: "https://media.giphy.com/media/3o7aD2saalFrAlzvn2/giphy.gif",
        width: "200",
        height: "133",
      },
      fixed_height: {
        url: "https://media.giphy.com/media/3o7aD2saalFrAlzvn2/giphy.gif",
        width: "300",
        height: "200",
      },
      downsized: {
        url: "https://media.giphy.com/media/3o7aD2saalFrAlzvn2/giphy.gif",
        width: "480",
        height: "320",
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
