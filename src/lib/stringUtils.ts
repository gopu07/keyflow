/**
 * Strips punctuation from the given snippet text.
 * 
 * - Removes: commas, periods, semicolons, colons, question marks, exclamation marks.
 * - Removes: double quotes (", “, ”), brackets, parentheses, braces, em-dashes (—), and en-dashes (–).
 * - Removes: single quotes/apostrophes (', ‘, ’) EXCEPT when they are surrounded by letters on both sides (contractions).
 *   This will keep contractions like "don't" intact, but strip trailing possessives like "students'" to "students".
 * - Collapses multiple spaces into a single space.
 * - Trims leading/trailing whitespace.
 */
export function stripPunctuation(text: string): string {
    // 1. Remove general punctuation marks, quotes, brackets, and dashes
    let result = text.replace(/[,.;:!?()\[\]{}"“”«»—–]/g, "");

    // 2. Remove single quotes/apostrophes unless they are surrounded by letters on both sides
    result = result.replace(/(?<![a-zA-Z])[’'‘]|[’'‘](?![a-zA-Z])/g, "");

    // 3. Collapse multiple spaces into a single space
    result = result.replace(/\s+/g, " ");

    // 4. Trim leading and trailing whitespace
    return result.trim();
}
