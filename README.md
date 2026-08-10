# Datalith website

Static download and documentation website for [Datalith](https://github.com/mycelium-build/datalith), built with [Astro Starlight](https://starlight.astro.build/).

## Local development

The build imports Markdown from `../datalith/docs/vault` by default. Override
that location with `DATALITH_SOURCE_DIR` when needed. For a local build against
a private Datalith repository, `DATALITH_READ_TOKEN` can be a temporary
read-only token.

```sh
npm install
DATALITH_READ_TOKEN=... npm run build
npm run dev
```

The workflow uses the organization’s `datalith-bot` GitHub App to read the
private Datalith repository. Add the existing app credentials as Actions
secrets named `AUTOMATION_APP_ID` and `AUTOMATION_APP_PRIVATE_KEY`. The
private key is used only during the build and is never included in the
generated website.

## GitHub Pages

The deployment workflow is intentionally manual for now. Run **Actions →
Deploy website → Run workflow** and choose the Datalith ref to import.

The `datalith-bot` installation must include the `datalith` repository. Its
token needs read-only Contents access to `datalith`; it does not need access to
`datalith-site` because that repository is checked out with the workflow token.

The build fetches published releases from the GitHub Releases API, filters out
drafts, and exposes stable releases and release candidates in the download
selector. Documentation is regenerated from `datalith/docs/vault` on every
deployment.
