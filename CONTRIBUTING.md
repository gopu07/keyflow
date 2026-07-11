# Contributing to Keyflow

First off, thank you for taking the time to contribute! Keyflow is an open-source project, and contributions of all kinds (bug reports, feature ideas, code improvements, new quote categories) are extremely welcome.

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

## How Can I Contribute?

### Reporting Bugs
If you find a bug in the application, please open an issue using our **Bug Report** template.
- Make sure to search existing issues first to check if the bug has already been reported.
- Describe the bug clearly, listing the exact steps to reproduce it.
- Include details about your browser, operating system, and any error logs from the browser console.

### Suggesting Enhancements
If you have ideas for new features or user interface improvements:
- Open an issue using the **Feature Request** template.
- Explain the behavior you'd like to see and why it would be beneficial to users.
- Mockups, diagrams, or screenshots are highly appreciated!

### Adding New Quote Datasets
Keyflow handles custom lists of quotes in `src/data/quotes/<category>.json`. If you want to add a new category:
1. Create a new JSON file named `<category_name>.json`.
2. Ensure it follows the required schema:
   ```json
   {
       "id": "category-001",
       "text": "Your quote text here...",
       "author": "Author Name",
       "source": "Book/Movie/Source Name",
       "category": "category",
       "license": "CC-BY-4.0",
       "difficulty": "easy",
       "length": 23
   }
   ```
3. Run the dataset validator:
   ```bash
   python verify_dataset.py
   ```
   All quote collections must have at least 200 quotes, match difficulty criteria based on length, and contain zero duplicate quotes.

### Code Contributions
If you want to contribute code (fixes or new features):
1. **Fork the Repository** and clone it locally.
2. **Create a Branch**: Use a descriptive name like `fix/ghost-caret-latency` or `feature/custom-themes`.
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Make Your Changes**: Keep code clean, modular, and write comments where appropriate.
5. **Run Tests**: Ensure all unit tests pass before submitting.
   ```bash
   npm run test
   ```
6. **Format Your Code**: We use Prettier with a tab width of 4 spaces (defined in `package.json`).
7. **Commit and Push**: Write descriptive, imperatively phrased commit messages (e.g., `feat: add sports category quotes`).
8. **Submit a Pull Request**: Fill out the PR template completely and link the related issue.

## Development Stack
Keyflow uses a modern lightweight stack:
- **Frontend**: React (16.13.1), TypeScript, Vanilla CSS
- **Bundler**: Vite (v5.1.4)
- **Database**: Firebase Realtime Database
- **Testing**: Jest + ts-jest

Thank you for making Keyflow better for everyone!
