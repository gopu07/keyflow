export type TestMode = 'quote' | 'time' | 'words' | 'custom';
export type TimeOption = 15 | 30 | 60;
export type WordsOption = 25 | 50 | 100;

export interface TestConfig {
    mode: TestMode;
    timeOption: TimeOption;
    wordsOption: WordsOption;
    customText: string;
    quoteCategory?: string;
}
