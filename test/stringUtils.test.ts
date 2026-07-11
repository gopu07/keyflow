import { stripPunctuation } from "../src/lib/stringUtils";

it("should strip basic punctuation characters", () => {
    expect(stripPunctuation("Hello, world!")).toEqual("Hello world");
    expect(stripPunctuation("Wait; check this: one, two.")).toEqual("Wait check this one two");
});

it("should preserve contractions", () => {
    expect(stripPunctuation("Don't you dare!")).toEqual("Don't you dare");
    expect(stripPunctuation("It's a beautiful day, isn't it?")).toEqual("It's a beautiful day isn't it");
    expect(stripPunctuation("They'd like to go.")).toEqual("They'd like to go");
});

it("should strip trailing possessives", () => {
    // Trailing possessive choice: students' -> students (apostrophe not followed by a letter is stripped)
    expect(stripPunctuation("The students' lounge.")).toEqual("The students lounge");
    expect(stripPunctuation("James' book.")).toEqual("James book");
});

it("should collapse multiple spaces and trim whitespace", () => {
    expect(stripPunctuation("  Hello    world!  ")).toEqual("Hello world");
    expect(stripPunctuation("Hello — world!")).toEqual("Hello world");
    expect(stripPunctuation("Hello – world!")).toEqual("Hello world");
});

it("should handle mixed quotes and smart quotes", () => {
    expect(stripPunctuation("“Yes,” he said, “that's it.”")).toEqual("Yes he said that's it");
    expect(stripPunctuation("'Hello' is a quote.")).toEqual("Hello is a quote");
});
