# Deployment

The website is deployed to [mycelium-build.github.io/datalith](https://mycelium-build.github.io/datalith/) through GitHub Pages.

Deployment runs after successful CI on a push to website `main`, using that validated website commit and application `main`. It can also be started manually to select an application ref.
The workflow imports documentation and assets from `mycelium-build/datalith-app` before publishing the site.

## GitHub setup

The workflow uses the organization's `datalith-bot` GitHub App to read the Datalith repository.
Configure these Actions secrets in the `datalith` repository:

- `AUTOMATION_APP_CLIENT_ID`
- `AUTOMATION_APP_PRIVATE_KEY`

The App installation must include the `datalith-app` repository with read-only Contents access.

## Deploy

1. Open the **Actions** tab in the `datalith` repository.
2. Select **Deploy website**.
3. Select **Run workflow**.
4. Enter the application Git ref to import, or keep `main`. The current website requires both channel icons, available in `v0.2.0-rc.1` and current `main`; see [application asset compatibility](../CONTRIBUTING.md#application-assets-and-source-refs).
5. Start the workflow and wait for the GitHub Pages deployment to complete.

The workflow sets `SITE_BASE` to `/datalith` and passes the selected ref to documentation and asset synchronization. Download choices use the application's published release metadata, independently of the source ref.

After a website fix reaches `main` and CI passes, start a new run so it uses the corrected website code:

```bash
gh workflow run deploy.yml --repo mycelium-build/datalith --ref main -f source_ref=v0.2.0-rc.1
```

Re-running an old failed run would reuse its old website revision. Wait for the new Pages deployment to succeed, then verify `/datalith/`, `/datalith/docs/vault/welcome/`, `/datalith/datalith.png`, and `/datalith/datalith-preview.png`, plus the Preview download links.

## Build requirements

The CI build requires `DATALITH_READ_TOKEN` from the GitHub App token and does not allow `DATALITH_SOURCE_DIR`. The token is used only to read the selected Datalith ref and fetch release metadata.
