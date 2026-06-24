import * as React from 'react';
import './HiddenTextInput.css';

interface IProps {
    onChange: (text: string) => void,
    onCharacterKeypress: (text: string) => void,
    onBackspaceKeypress: () => void,
    maxLength: number,
    disabled?: boolean,
}
interface IState { text: string; }

class HiddenTextInput extends React.Component<IProps, IState> {
    textInput: any

    constructor(props: IProps) {
        super(props)
        this.state = { text: "" }
        this.handleKeyPress = this.handleKeyPress.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.onBlur = this.onBlur.bind(this)
        this.textInput = React.createRef();
    }

    public componentDidMount() {
        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("keypress", this.handleKeyPress);
        if (!this.props.disabled && this.textInput.current) {
            this.textInput.current.focus();
        }
    }

    public componentDidUpdate(prevProps: IProps) {
        if (prevProps.disabled && !this.props.disabled && this.textInput.current) {
            this.textInput.current.focus();
        }
    }

    public onBlur() {
        if (this.props.disabled) {
            return;
        }
        let dis = this;
        setTimeout(function() { 
            if (dis.textInput.current && !dis.props.disabled) {
                dis.textInput.current.focus() 
            }
        }, 1);
    }

    public componentWillUnmount() {
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("keypress", this.handleKeyPress);
    }

    public handleKeyDown(e: KeyboardEvent) {
        if (this.props.disabled) {
            return;
        }
        if (e.key == 'Backspace') {
            this.handleBackspace()
            e.preventDefault()
        }
    }

    public handleKeyPress(e: KeyboardEvent) {
        if (this.props.disabled) {
            return;
        }
        // Hack! All non-printable chars seem to have a 'key' value that is
        // longer than one character
        if (e.key.length != 1) {
            return
        }

        this.handleCharacter(e.key)
        e.preventDefault()
    }

    public handleBackspace() {
        this.props.onBackspaceKeypress()
        this.changeText(this.state.text.slice(0, -1))
    }

    public handleCharacter(character: string) {
        if (this.isAtMaxLength()) {
            return
        }

        this.props.onCharacterKeypress(character)
        this.changeText(this.state.text + character)
    }

    public changeText(value: string) {
        this.setState({text: value});
        this.props.onChange(value);
    }

    public isAtMaxLength() {
        return this.state.text.length == this.props.maxLength;
    }

    public render() {
        return (
            <input className="hidden-text-input-container"
                   ref={this.textInput}
                   onBlur={this.onBlur}
                   disabled={this.props.disabled}
                   aria-label="Type the text snippet above"
                   aria-autocomplete="none"
                   autoCapitalize="off"
                   autoComplete="off"
                   autoCorrect="off"
                   spellCheck={false}
            />
        );
    }
}

export default HiddenTextInput;
