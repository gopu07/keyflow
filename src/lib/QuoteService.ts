import { formatQuoteAuthor } from "./quoteUtils";

export interface Quote {
    id: string;
    text: string;
    author: string;
    source: string;
    category: string;
    license: string;
    difficulty: "easy" | "medium" | "hard";
    length: number;
}

export class QuoteService {
    private static instance: QuoteService;
    private quotesCache: { [category: string]: Quote[] } = {};
    private recentlyUsedIds: string[] = [];

    // Vite dynamic glob import to find all quote JSON files
    // This allows dropping any new JSON file into the quotes directory,
    // and it will automatically be scanned and included!
    private modules = import.meta.glob("../data/quotes/*.json");

    private constructor() {
        this.loadRecentlyUsed();
    }

    public static getInstance(): QuoteService {
        if (!QuoteService.instance) {
            QuoteService.instance = new QuoteService();
        }
        return QuoteService.instance;
    }

    private loadRecentlyUsed(): void {
        try {
            const stored = localStorage.getItem("keyflow_recently_used_quotes");
            if (stored) {
                this.recentlyUsedIds = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load recently used quotes", e);
        }
    }

    private saveRecentlyUsed(): void {
        try {
            localStorage.setItem("keyflow_recently_used_quotes", JSON.stringify(this.recentlyUsedIds));
        } catch (e) {
            console.error("Failed to save recently used quotes", e);
        }
    }

    /**
     * Get list of all discovered quote categories.
     * Derived dynamically from the JSON filenames in the quotes directory.
     */
    public getCategories(): string[] {
        return Object.keys(this.modules).map(key => {
            const parts = key.split("/");
            const filename = parts[parts.length - 1];
            return filename.replace(".json", "");
        });
    }

    /**
     * Lazy-load and cache the JSON content for a specific category.
     */
    public async loadCategory(category: string): Promise<Quote[]> {
        if (this.quotesCache[category]) {
            return this.quotesCache[category];
        }

        const path = `../data/quotes/${category}.json`;
        const loader = this.modules[path];
        if (!loader) {
            throw new Error(`Category ${category} not found`);
        }

        const module = await loader() as { default: Quote[] };
        this.quotesCache[category] = module.default;
        return module.default;
    }

    /**
     * Randomly select a passage from the chosen category or from all mixed categories.
     * Ensures recently typed quotes are not repeated until a large portion has been exhausted.
     */
    public async getRandomQuote(category: string): Promise<Quote> {
        let pool: Quote[] = [];

        if (category === "random") {
            const categories = this.getCategories();
            // Load all categories dynamically
            const promises = categories.map(cat => this.loadCategory(cat));
            const allQuotes = await Promise.all(promises);
            // Flattens the array using ES5 loop to match tsconfig target
            for (const list of allQuotes) {
                for (const q of list) {
                    pool.push(q);
                }
            }
        } else {
            pool = await this.loadCategory(category);
        }

        if (pool.length === 0) {
            throw new Error(`No quotes available in pool for category: ${category}`);
        }

        // Filter out recently used quotes using indexOf to avoid ES6 target issues
        let filteredPool = pool.filter(q => this.recentlyUsedIds.indexOf(q.id) === -1);

        // Define a "large portion": e.g., if less than 25% of pool is left, or less than 15 quotes,
        // we clear the oldest half of the history to restore the pool size.
        const minPoolSize = Math.max(15, Math.floor(pool.length * 0.25));
        if (filteredPool.length < minPoolSize) {
            // Keep only the most recent half of the history
            const halfLength = Math.floor(this.recentlyUsedIds.length / 2);
            this.recentlyUsedIds = this.recentlyUsedIds.slice(halfLength);
            this.saveRecentlyUsed();
            filteredPool = pool.filter(q => this.recentlyUsedIds.indexOf(q.id) === -1);
        }

        // Fallback if still empty
        if (filteredPool.length === 0) {
            filteredPool = pool;
        }

        const selected = filteredPool[Math.floor(Math.random() * filteredPool.length)];

        // Append to recently used
        this.recentlyUsedIds.push(selected.id);

        // Keep history size capped at 1000 items (reasonable and bounds storage growth)
        if (this.recentlyUsedIds.length > 1000) {
            this.recentlyUsedIds.shift();
        }

        this.saveRecentlyUsed();
        return selected;
    }

    public formatAuthor(quote: Quote): string {
        return formatQuoteAuthor(quote.author, quote.source);
    }
}
