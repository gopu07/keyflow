import * as React from 'react';
import * as ReactDOM from 'react-dom';
import SnippetGenerator from './lib/SnippetGenerator';
import App from './App';
import './index.css';

var text = new SnippetGenerator().getRandomSnippet();



text = text.replace(/\s+/gm, " ");
console.log(text);

ReactDOM.render(
  <App snippetText={text} />,
  document.getElementById('root') as HTMLElement
);
