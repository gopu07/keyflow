import { formatQuoteAuthor } from "../src/lib/quoteUtils";

describe("quoteUtils - formatQuoteAuthor", () => {
    it("should format both author and source when both are valid", () => {
        expect(formatQuoteAuthor("Charles Dickens", "A Tale of Two Cities")).toBe("Charles Dickens\nA Tale of Two Cities");
    });

    it("should format only author when source is empty or a placeholder", () => {
        expect(formatQuoteAuthor("Charles Dickens", "")).toBe("Charles Dickens");
        expect(formatQuoteAuthor("Charles Dickens", "Unknown Source")).toBe("Charles Dickens");
        expect(formatQuoteAuthor("Charles Dickens", "Collected Writings")).toBe("Charles Dickens");
    });

    it("should format only source when author is empty or a placeholder", () => {
        expect(formatQuoteAuthor("", "A Tale of Two Cities")).toBe("A Tale of Two Cities");
        expect(formatQuoteAuthor("Unknown Author", "A Tale of Two Cities")).toBe("A Tale of Two Cities");
        expect(formatQuoteAuthor("Unknown Character", "A Tale of Two Cities")).toBe("A Tale of Two Cities");
    });

    it("should return empty string when both author and source are empty/placeholders", () => {
        expect(formatQuoteAuthor("Unknown Author", "Unknown Source")).toBe("");
        expect(formatQuoteAuthor("", "Collected Writings")).toBe("");
    });

    it("should preserve 'Anonymous' as a valid author", () => {
        expect(formatQuoteAuthor("Anonymous", "Computer Science Classic")).toBe("Anonymous\nComputer Science Classic");
    });
});
