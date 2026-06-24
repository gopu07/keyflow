const isPlaceholder = (val: string | null | undefined): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toLowerCase();
    return trimmed === "" || 
           trimmed === "unknown author" || 
           trimmed === "unknown character" || 
           trimmed === "unknown source" || 
           trimmed === "unknown" || 
           trimmed === "n/a";
};

const genericSources = ["collected writings", "speech or publication", "general knowledge", "historical quote", "unknown source"];
const isGenericSource = (val: string | null | undefined): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toLowerCase();
    return genericSources.indexOf(trimmed) !== -1;
};

/**
 * Formats quote metadata for display.
 * Returns only valid author/source and handles placeholders gracefully.
 */
export function formatQuoteAuthor(rawAuthor: string | null | undefined, rawSource: string | null | undefined): string {
    const author = isPlaceholder(rawAuthor) ? "" : rawAuthor!.trim();
    const source = (isPlaceholder(rawSource) || isGenericSource(rawSource)) ? "" : rawSource!.trim();

    if (author && source) {
        return `${author}\n${source}`;
    } else if (author) {
        return author;
    } else if (source) {
        return source;
    }
    return "";
}
