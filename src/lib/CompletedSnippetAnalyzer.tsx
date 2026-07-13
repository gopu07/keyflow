import { IKeystrokeLog } from "./KeystrokeRecorder";
import * as _ from "lodash";

class CompletedSnippetAnalyzer {
    snippetText: string;
    keystrokeLogs: IKeystrokeLog[];
    lowercase: boolean;

    constructor(snippetText: string, keystrokeLogs: IKeystrokeLog[], lowercase: boolean = false) {
        this.snippetText = snippetText;
        this.keystrokeLogs = keystrokeLogs || [];
        this.lowercase = lowercase;
    }

    public averageSpeed(): number {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return 0;
        }
        const firstLog = _.first(this.keystrokeLogs);
        const lastLog = _.last(this.keystrokeLogs);
        if (!firstLog || !lastLog) return 0;
        
        const firstLogTimestamp = new Date(firstLog.timestamp);
        const lastLogTimestamp = new Date(lastLog.timestamp);

        let nTypedChars = this.keystrokeLogs.filter(log => log.key.type === "character").length - 
                          this.keystrokeLogs.filter(log => log.key.type === "backspace").length;
        
        if (nTypedChars <= 0) return 0;
        nTypedChars = Math.min(nTypedChars, this.snippetText.length);

        return calculateWPM(firstLogTimestamp, lastLogTimestamp, nTypedChars);
    }

    public speedsAtIndices(): number[] {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return [];
        }
        
        let groupedLogs = this.logsGroupedBySnippetIndex();

        let finalTimestamps = _.map(groupedLogs, function(
            logs: IKeystrokeLog[],
            snippetIndex
        ) {
            if (!logs || logs.length === 0) return new Date();
            return _.last(logs)!.timestamp;
        });

        let speedsAtIndices = _.map(finalTimestamps, function(
            timestamp,
            snippetIndex
        ) {
            if (snippetIndex == 0) {
                return 0;
            } else {
                return calculateRollingAvgSpeed(
                    finalTimestamps.slice(0, snippetIndex + 1)
                );
            }
        });

        return speedsAtIndices;
    }

    public mistakeIndices(): number[] {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return [];
        }
        
        var mistakeIndices: number[] = [];
        let groupedLogs = this.logsGroupedBySnippetIndex();

        _.forEach(groupedLogs, function(logs, snippetIndex) {
            if (_.some(logs, log => log.key.type == "backspace")) {
                mistakeIndices.push(snippetIndex);
            }
        });

        return mistakeIndices;
    }

    public mistakeCount(): number {
        const errorCounts = this.getErrorCounts();
        return errorCounts.corrected + errorCounts.uncorrected;
    }

    public logsGroupedBySnippetIndex(): IKeystrokeLog[][] {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return [];
        }
        
        let logsGroupedBySnippetIndex: IKeystrokeLog[][] = [];
        for (let i = 0; i < this.snippetText.length; i++) {
            logsGroupedBySnippetIndex[i] = [];
        }
        
        let currentCursor = 0;
        for (let log of this.keystrokeLogs) {
            if (log.key.type === "character") {
                if (currentCursor < this.snippetText.length) {
                    logsGroupedBySnippetIndex[currentCursor].push(log);
                    currentCursor++;
                }
            } else if (log.key.type === "backspace") {
                if (currentCursor > 0) {
                    currentCursor--;
                    logsGroupedBySnippetIndex[currentCursor].push(log);
                }
            }
        }
        
        return logsGroupedBySnippetIndex;
    }

    private simulateKeystrokes(): { typed: string; expected: string; index: number; isCorrect: boolean; wasBackspaced: boolean }[] {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return [];
        }
        
        let allTyped: { typed: string; expected: string; index: number; isCorrect: boolean; wasBackspaced: boolean }[] = [];
        let activeLogs: ({ typed: string; expected: string; index: number; isCorrect: boolean; wasBackspaced: boolean } | null)[] = new Array(this.snippetText.length).fill(null);
        let currentCursor = 0;

        for (let log of this.keystrokeLogs) {
            if (log.key.type === "character") {
                if (currentCursor < this.snippetText.length) {
                    let expectedChar = this.snippetText[currentCursor];
                    const isMatch = this.lowercase
                        ? log.key.character.toLowerCase() === expectedChar.toLowerCase()
                        : log.key.character === expectedChar;
                    let newLog = {
                        typed: log.key.character,
                        expected: expectedChar,
                        index: currentCursor,
                        isCorrect: isMatch,
                        wasBackspaced: false
                    };
                    allTyped.push(newLog);
                    activeLogs[currentCursor] = newLog;
                    currentCursor++;
                }
            } else if (log.key.type === "backspace") {
                if (currentCursor > 0) {
                    currentCursor--;
                    let lastActive = activeLogs[currentCursor];
                    if (lastActive) {
                        lastActive.wasBackspaced = true;
                        activeLogs[currentCursor] = null;
                    }
                }
            }
        }
        return allTyped;
    }

    public getMostMistypedCharacters(): { typed: string; expected: string; count: number }[] {
        let allTyped = this.simulateKeystrokes();
        if (allTyped.length === 0) {
            return [];
        }
        
        let incorrect = allTyped.filter(log => !log.isCorrect && log.expected !== "");
        
        let counts: { [key: string]: { typed: string; expected: string; count: number } } = {};
        
        for (let log of incorrect) {
            let typedLower = log.typed.toLowerCase();
            let expectedLower = log.expected.toLowerCase();
            let key = `${typedLower}_instead_of_${expectedLower}`;
            if (!counts[key]) {
                counts[key] = { typed: typedLower, expected: expectedLower, count: 0 };
            }
            counts[key].count++;
        }
        
        return _.orderBy(_.values(counts), ["count"], ["desc"]);
    }

    public getErrorFrequencyPerIndex(): number[] {
        let allTyped = this.simulateKeystrokes();
        let frequencies = new Array(this.snippetText.length).fill(0);
        
        for (let log of allTyped) {
            if (!log.isCorrect && log.index >= 0 && log.index < this.snippetText.length) {
                frequencies[log.index]++;
            }
        }
        
        return frequencies;
    }

    public getErrorCounts(): { corrected: number; uncorrected: number } {
        let allTyped = this.simulateKeystrokes();
        
        let corrected = 0;
        let uncorrected = 0;
        
        for (let log of allTyped) {
            if (!log.isCorrect) {
                if (log.wasBackspaced) {
                    corrected++;
                } else {
                    uncorrected++;
                }
            }
        }
        
        return { corrected, uncorrected };
    }

    public getPerWordWPMs(): number[] {
        if (!this.keystrokeLogs || this.keystrokeLogs.length === 0) {
            return [];
        }
        
        let groupedLogs = this.logsGroupedBySnippetIndex();
        let wordRegex = /\S+/g;
        let match;
        let wpms: number[] = [];

        while ((match = wordRegex.exec(this.snippetText)) !== null) {
            let start = match.index;
            let end = match.index + match[0].length - 1;

            if (end >= this.snippetText.length) continue;
            let logsForEnd = groupedLogs[end];
            if (!logsForEnd || logsForEnd.length === 0) continue;

            let startTime: Date;
            if (start === 0) {
                let firstLog = _.first(this.keystrokeLogs);
                if (!firstLog) continue;
                startTime = new Date(firstLog.timestamp);
            } else {
                let prevEndLogs = groupedLogs[start - 1];
                if (!prevEndLogs || prevEndLogs.length === 0) continue;
                startTime = new Date(_.last(prevEndLogs)!.timestamp);
            }

            let endTime = _.last(logsForEnd)!.timestamp;
            
            let durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
            if (durationMs <= 0) continue;

            let durationMin = durationMs / (1000 * 60);
            let wordLength = match[0].length;
            if (end + 1 < this.snippetText.length && this.snippetText[end + 1] === ' ') {
                wordLength += 1;
            }

            let wpm = (wordLength / 5) / durationMin;
            wpms.push(wpm);
        }

        return wpms;
    }

    public getConsistencyScore(): { sd: number; percentage: number; label: "consistent" | "moderate" | "erratic" } {
        let wpms = this.getPerWordWPMs();
        if (wpms.length < 2) {
            return { sd: 0, percentage: 100, label: "consistent" };
        }

        let mean = _.sum(wpms) / wpms.length;
        if (mean <= 0) {
            return { sd: 0, percentage: 0, label: "erratic" };
        }

        let squaredDiffs = _.map(wpms, wpm => Math.pow(wpm - mean, 2));
        let variance = _.sum(squaredDiffs) / wpms.length;
        let sd = Math.sqrt(variance);

        let cv = sd / mean;
        let percentage = Math.max(0, Math.min(100, (1 - cv) * 100));

        let label: "consistent" | "moderate" | "erratic";
        if (percentage >= 80) {
            label = "consistent";
        } else if (percentage >= 60) {
            label = "moderate";
        } else {
            label = "erratic";
        }

        return { sd, percentage, label };
    }
}

function calculateRollingAvgSpeed(previousTimestamps: Date[]): number {
    if (previousTimestamps.length > 5) {
        previousTimestamps = previousTimestamps.slice(0, 5);
    }

    let lastTimestamp = _.last(previousTimestamps)!;
    let firstTimestamp = _.first(previousTimestamps)!;
    let charCount = previousTimestamps.length - 1;

    return calculateWPM(new Date(firstTimestamp), new Date(lastTimestamp), charCount);
}

function calculateWPM(
    firstTimestamp: Date,
    lastTimestamp: Date,
    nTypedChars: number
) {
    let durationMilliseconds =
        new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

    if (durationMilliseconds <= 0) {
        return 0;
    }

    let durationMinutes = durationMilliseconds / (1000 * 60);

    let charCount = nTypedChars;
    let cpm = charCount / durationMinutes;

    return Math.round(cpm / 5);
}

export default CompletedSnippetAnalyzer;
