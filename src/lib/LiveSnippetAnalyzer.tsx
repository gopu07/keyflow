import * as _ from "lodash";

class LiveSnippetAnalyzer {
    actualText: string
    typedText: string
    lowercase: boolean

    constructor(actualText: string, typedText: string, lowercase: boolean = false) {
        this.actualText = actualText;
        this.typedText = typedText;
        this.lowercase = lowercase;
    }

    public firstMistakeIndex(): number | null {
        const actualChars = this.actualText.split('');
        const typedChars = this.typedText.split('');

        let firstMistakeIndex: number | null = null;
        _.each(actualChars, (value, index) => {
            if (firstMistakeIndex) {
                return;
            }

            if (typedChars[index] === undefined) {
                return;
            }

            const charA = typedChars[index];
            const charB = actualChars[index];
            const isMatch = this.lowercase
                ? charA.toLowerCase() === charB.toLowerCase()
                : charA === charB;

            if (!isMatch) {
                firstMistakeIndex = index;
            }
        });

        return firstMistakeIndex
    }

    public cursorIndex() {
        return this.typedText.length - 1;
    }

    public percentageCompleted(): number {
        if (this.actualText.length === 0) return 0;
        return (this.typedText.length / this.actualText.length) * 100;
    }

    public isFinished() {
        return this.typedText.length >= this.actualText.length;
    }
}

export default LiveSnippetAnalyzer;
