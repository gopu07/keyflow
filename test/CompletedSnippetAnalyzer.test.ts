import CompletedSnippetAnalyzer from "../src/lib/CompletedSnippetAnalyzer";
import { IKeystrokeLog } from "../src/lib/KeystrokeRecorder";

function dummyAnalyzer() {
    // 60wpm = 300cpm
    // 300cpm = 5cps
    // 5cps = 5c per 1000 ms
    // 5c per 1000 ms = ~ 200ms
    let startTime = new Date();
    let char_with_delay = function(
        char: string,
        delayInMilliseconds: number
    ): IKeystrokeLog {
        return {
            key: { type: "character", character: char },
            timestamp: ms_from_date(startTime, delayInMilliseconds)
        };
    };
    return new CompletedSnippetAnalyzer("abcdef", [
        char_with_delay("a", 0),
        char_with_delay("b", 200),
        char_with_delay("c", 400),
        char_with_delay("d", 600),
        char_with_delay("e", 800),
        char_with_delay("f", 1000)
    ]);
}

function dummyAnalyzerWithOneMistake() {
    let startTime = new Date();
    let char_with_delay = function(
        char: string,
        delayInMilliseconds: number
    ): IKeystrokeLog {
        return {
            key: { type: "character", character: char },
            timestamp: ms_from_date(startTime, delayInMilliseconds)
        };
    };
    let backspace_with_delay = function(
        delayInMilliseconds: number
    ): IKeystrokeLog {
        return {
            key: { type: "backspace" },
            timestamp: ms_from_date(startTime, delayInMilliseconds)
        };
    };
    return new CompletedSnippetAnalyzer("abcdef", [
        char_with_delay("a", 0),
        char_with_delay("c", 200),
        backspace_with_delay(300),
        char_with_delay("b", 400),
        char_with_delay("c", 450),
        char_with_delay("d", 600),
        char_with_delay("e", 800),
        char_with_delay("f", 1000)
    ]);
}

it("averageSpeed", () => {
    let analyzer = dummyAnalyzer();
    expect(analyzer.averageSpeed()).toEqual(72);
});

it("averageSpeed with one mistake", () => {
    let analyzer = dummyAnalyzerWithOneMistake();
    expect(analyzer.averageSpeed()).toEqual(72);
});

it("speedAtIndices", () => {
    let analyzer = dummyAnalyzer();
    expect(analyzer.speedsAtIndices()).toEqual([0, 60, 60, 60, 60, 60]);
});

it("speedAtIndices with one mistake", () => {
    let analyzer = dummyAnalyzerWithOneMistake();
    expect(analyzer.speedsAtIndices()).toEqual([0, 30, 53, 60, 60, 60]);
});

it("mistakeIndices with no mistakes", () => {
    let analyzer = dummyAnalyzer();
    expect(analyzer.mistakeIndices()).toEqual([]);
});

it("mistakeIndices with one mistake", () => {
    let analyzer = dummyAnalyzerWithOneMistake();
    expect(analyzer.mistakeIndices()).toEqual([1]);
});

it("mistakeIndices with > 1 mistake", () => {
    let analyzer = new CompletedSnippetAnalyzer("abcde", [
        { key: { type: "character", character: "a" }, timestamp: new Date() },
        { key: { type: "character", character: "c" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "b" }, timestamp: new Date() },
        { key: { type: "character", character: "f" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "c" }, timestamp: new Date() },
        { key: { type: "character", character: "d" }, timestamp: new Date() },
        { key: { type: "character", character: "e" }, timestamp: new Date() }
    ]);

    expect(analyzer.mistakeIndices()).toEqual([1, 2]);
});

it("mistakeIndices with mixed case typing", () => {
    let analyzer = new CompletedSnippetAnalyzer("AbCdEf", [
        { key: { type: "character", character: "a" }, timestamp: new Date() },
        { key: { type: "character", character: "B" }, timestamp: new Date() },
        { key: { type: "character", character: "c" }, timestamp: new Date() },
        { key: { type: "character", character: "D" }, timestamp: new Date() },
        { key: { type: "character", character: "e" }, timestamp: new Date() },
        { key: { type: "character", character: "F" }, timestamp: new Date() }
    ]);

    expect(analyzer.mistakeIndices()).toEqual([]);
});

function ms_from_date(date: Date, ms: number): Date {
    let new_date = new Date();
    new_date.setTime(date.getTime() + ms);
    return new_date;
}

it("getMostMistypedCharacters", () => {
    let analyzer = new CompletedSnippetAnalyzer("abc", [
        { key: { type: "character", character: "a" }, timestamp: new Date() },
        { key: { type: "character", character: "x" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "y" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "b" }, timestamp: new Date() },
        { key: { type: "character", character: "z" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "c" }, timestamp: new Date() }
    ]);

    expect(analyzer.getMostMistypedCharacters()).toEqual([
        { typed: "x", expected: "b", count: 1 },
        { typed: "y", expected: "b", count: 1 },
        { typed: "z", expected: "c", count: 1 }
    ]);
});

it("getErrorFrequencyPerIndex", () => {
    let analyzer = new CompletedSnippetAnalyzer("abc", [
        { key: { type: "character", character: "a" }, timestamp: new Date() },
        { key: { type: "character", character: "x" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "y" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "b" }, timestamp: new Date() },
        { key: { type: "character", character: "c" }, timestamp: new Date() }
    ]);

    expect(analyzer.getErrorFrequencyPerIndex()).toEqual([0, 2, 0]);
});

it("getErrorCounts", () => {
    let analyzer = new CompletedSnippetAnalyzer("abc", [
        { key: { type: "character", character: "a" }, timestamp: new Date() },
        { key: { type: "character", character: "x" }, timestamp: new Date() },
        { key: { type: "backspace" }, timestamp: new Date() },
        { key: { type: "character", character: "b" }, timestamp: new Date() },
        { key: { type: "character", character: "z" }, timestamp: new Date() }
    ]);

    expect(analyzer.getErrorCounts()).toEqual({ corrected: 1, uncorrected: 1 });
});

it("getConsistencyScore", () => {
    let startTime = new Date();
    let ms = (amount: number) => {
        let d = new Date();
        d.setTime(startTime.getTime() + amount);
        return d;
    };
    let analyzer = new CompletedSnippetAnalyzer("hello world", [
        { key: { type: "character", character: "h" }, timestamp: ms(0) },
        { key: { type: "character", character: "e" }, timestamp: ms(100) },
        { key: { type: "character", character: "l" }, timestamp: ms(200) },
        { key: { type: "character", character: "l" }, timestamp: ms(300) },
        { key: { type: "character", character: "o" }, timestamp: ms(400) },
        { key: { type: "character", character: " " }, timestamp: ms(500) },
        { key: { type: "character", character: "w" }, timestamp: ms(1000) },
        { key: { type: "character", character: "o" }, timestamp: ms(1500) },
        { key: { type: "character", character: "r" }, timestamp: ms(2000) },
        { key: { type: "character", character: "l" }, timestamp: ms(2500) },
        { key: { type: "character", character: "d" }, timestamp: ms(3000) }
    ]);

    let score = analyzer.getConsistencyScore();
    expect(Math.round(score.sd)).toEqual(78);
    expect(score.label).toEqual("erratic");
});
