# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-11

### Added
- **Multiplayer Mode**: Created real-time multiplayer racing lobbies using Firebase Realtime Database. Features room creation with code generation, guest joining, real-time progress bars, and WPM/accuracy tracking.
- **Ghost Caret Playback**: Added binary search-based playback system enabling users to race against their previous run in single-player tests.
- **Rich Analytics Details**: Added completed test analytics including:
  - Error Heatmap (visualizing error frequency per character index)
  - Consistency scoring based on coefficient of variation (CV) of rolling speed
  - Most mistyped characters count
  - Corrected vs. Uncorrected error counts
- **Quote Library**: Drop-in JSON quote categories under `src/data/quotes/` dynamically loaded using Vite's `import.meta.glob`.
- **Dataset Verifier**: Developed Python validation script (`verify_dataset.py`) ensuring quote databases contain zero duplicates, correct schema values, and difficulty ratings.
- **Test Suite**: Configured Jest with TypeScript (`ts-jest`) testing suite covering `CompletedSnippetAnalyzer`, `QuoteService`, and `SnippetGenerator`.
- **CSS Styling**: Added styling for multiplayer cards, lobbies, back buttons, toast notifications, leaderboard grids, and winner crown overlays.
- **Mobile Support**: Added hidden input support for touch devices.
