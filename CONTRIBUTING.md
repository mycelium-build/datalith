# Contributing

We welcome contributions! Here's how you can get involved:

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Project Guidelines

- Your branch name should follow [Conventional Branch](https://conventionalbranch.org/) format
- Use TypeScript with strict compiler checks
- Follow the existing code style
- Add doc comments for public items
- Write clear, descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) style

## Testing

Before submitting a pull request, please ensure that:

1. The project builds without errors (`npm run build`)
2. You run the formatter (`npm run fmt:check`)
3. You run the linter and fix all issues (`npm run lint`)
4. All tests pass (`npm test`)
5. The code follows the project guidelines
6. New functionality includes appropriate tests

## Third-Party Notices

When adding an npm dependency, update `package.json` and `package-lock.json`.
When adding a bundled asset, update `scripts/licenses/assets.json` and include its license file.
Do not edit `THIRD-PARTY-NOTICES.md` by hand; regenerate it with:

```bash
npm run licenses:generate
```

Before submitting a pull request, verify the result with:

```bash
npm run licenses:check
```

## Development Setup

### Prerequisites

- Node.js and npm
- Git
- A checkout of the Datalith repository at `../datalith`, or a local source path configured with `DATALITH_SOURCE_DIR`

### Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/mycelium-build/datalith-site.git
    cd datalith-site
    ```

2. Build the project:
    ```bash
    npm ci
    npm run build
    ```

3. Run the project:
    ```bash
    npm run dev
    ```

### Development Workflow

1. Make changes to the source code in the `src/` and `scripts/` directories.

2. Run tests:
    ```bash
    npm test
    ```

3. Check for lint issues:
    ```bash
    npm run lint
    ```

## Our stance on AI

We allow PR made with AI, but you are responsible for your code. This implies that you have reread all your code and reaches a good quality. You should always understand what you have done. If you clearly did not read the code or it is fully vibe coded we allow ourselves to close the PR without reason.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
