# Deployment

The website is deployed to [mycelium-build.github.io/datalith-site](https://mycelium-build.github.io/datalith-site/) through GitHub Pages.

Deployment is intentionally manual.
The workflow imports documentation and assets from a selected ref of the `datalith` repository before publishing the site.

## GitHub setup

The workflow uses the organization's `datalith-bot` GitHub App to read the Datalith repository.
Configure these Actions secrets in the `datalith-site` repository:

- `AUTOMATION_APP_ID`
- `AUTOMATION_APP_PRIVATE_KEY`

The App installation must include the `datalith` repository with read-only Contents access.

## Deploy

1. Open the **Actions** tab in the `datalith-site` repository.
2. Select **Deploy website**.
3. Select **Run workflow**.
4. Enter the Datalith Git ref to import, or keep `main`.
5. Start the workflow and wait for the GitHub Pages deployment to complete.

The workflow sets `SITE_BASE` to `/datalith-site` and passes the selected ref to the documentation, asset, and release-data synchronization steps.

## Build requirements

The CI build requires `DATALITH_READ_TOKEN` from the GitHub App token and does not allow `DATALITH_SOURCE_DIR`. The token is used only to read the selected Datalith ref and fetch release metadata.
