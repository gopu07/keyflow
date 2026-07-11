import * as React from 'react';
import './SnippetBox.css';

import { IKeystrokeLog } from "../lib/KeystrokeRecorder";
import CompletedSnippetAnalyzer from "../lib/CompletedSnippetAnalyzer";

import * as _ from "lodash";

interface ISnippetBoxProps {
    snippetText: string;
    keystrokeLogs: IKeystrokeLog[];
    errorFrequencies?: number[];
    lowercase?: boolean;
}

class CompletedSnippetBox extends React.Component<ISnippetBoxProps, {}> {
    public completedSnippetAnalyzer(): CompletedSnippetAnalyzer {
        return new CompletedSnippetAnalyzer(
            this.props.snippetText,
            this.props.keystrokeLogs,
            this.props.lowercase
        )
    }

    public getSpans(): JSX.Element[] {
        const spans: JSX.Element[] = [];
        const errorFrequencies = this.props.errorFrequencies || 
                                 this.completedSnippetAnalyzer().getErrorFrequencyPerIndex();

        const chars = this.props.snippetText.split('');
        _.each(chars, function(character, index) {
            let spanClass: string;
            if (errorFrequencies[index] > 0) {
                spanClass = 'char-was-wrong';
            } else {
                spanClass = 'char-was-correct';
            }

            spans.push(<span className={spanClass!}>{character}</span>);
        });

        return spans;
    }

    public render() {
        return (
            <div className="snippet-box-container">
                <div className="snippet-text">
                    <div className="completed-text">
                        { this.getSpans() }
                    </div>
                </div>
            </div>
        );
    }
}

export default CompletedSnippetBox;
