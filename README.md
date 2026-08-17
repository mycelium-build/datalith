# Datalith website

Static download and documentation website for [Datalith](https://github.com/mycelium-build/datalith), built with [Astro Starlight](https://starlight.astro.build/).

## Local development

The build imports from `../datalith` by default. Override that location with `DATALITH_SOURCE_DIR` (local builds only). When `DATALITH_SOURCE_DIR` is unset, `sync-docs` and `sync-assets` clone the Datalith repository at `DATALITH_SOURCE_REF` (default `main`) using `DATALITH_READ_TOKEN`. In CI the token is required and `DATALITH_SOURCE_DIR` must not be set. The build scripts read environment variables from a `.env` file in the project root when present (see `.env.example`).

```sh
npm install
npm run build
npm run dev
```

The `prebuild` step regenerates everything that comes from the Datalith repo:

- `sync-docs` imports the documentation vault and derives the docs search index (`src/data/search.json`) and docs graph (`src/data/graph.json`).
- `sync-assets` copies the app icon source (`datalith.txt`), pixel icons, theme JSON files, and Pixeloid fonts.
- `build-icons` generates `src/components/Icon.astro` from the synced `src/assets/icons/*.svg` files.
- `build-themes` translates the curated gpui-component theme JSONs into the CSS variables used by the whole site (`src/styles/themes.css` and `src/data/themes.json`).
- `fetch-releases` pulls published releases and the GitHub star count.

The workflow uses the organization's `datalith-bot` GitHub App to read the Datalith repository. Add the existing app credentials as Actions secrets named `AUTOMATION_APP_ID` and `AUTOMATION_APP_PRIVATE_KEY`.

## Deployment

The deployment workflow is intentionally manual for now. Run **Actions → Deploy website → Run workflow** and choose the Datalith ref to import.

The `datalith-bot` installation must include the `datalith` repository. Its token needs read-only Contents access to `datalith`.
