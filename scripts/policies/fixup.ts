/**
 * Post-processing for policygen-generated pages.
 *
 * policygen's templates are written for services that collect data,
 * so a few sections emit boilerplate that contradicts a "we collect no data" policy.
 * These pure helpers rewrite those sections and repair template bugs.
 * They are shared by `generate.ts` (in-place, after `policygen generate`) and
 * `check.ts` (in a temp dir, to compare against the committed pages).
 *
 * Keep the replacements in sync with the templates in node_modules/policygen.
 */

type Replacement = { find: string; replace: string }

type FixResult = { html: string; changed: number }

function apply(html: string, label: string, replacements: Replacement[]): FixResult {
    let changed = 0
    for (const { find, replace } of replacements) {
        if (html.includes(find)) {
            html = html.replaceAll(find, replace)
            changed += 1
        } else {
            console.warn(`[fixup] ${label}: pattern not found, skipping: ${find.slice(0, 60)}…`)
        }
    }
    return { html, changed }
}

function replaceSection(
    html: string,
    label: string,
    startMarker: string,
    endMarker: string,
    section: string,
): FixResult {
    const re = new RegExp(`\\s*${startMarker}[\\s\\S]*?${endMarker}`)
    if (!re.test(html)) {
        console.warn(`[fixup] ${label}: markers not found, skipping: ${startMarker}`)
        return { html, changed: 0 }
    }
    return {
        html: html.replace(re, `\n${section}\n  ${endMarker}`),
        changed: 1,
    }
}

const NO_DATA_USE_SECTION = `  <!-- Use of Information -->
  <section id="section-use" class="section">
    <h2 class="subheading">How we use or process your information</h2>
    <p class="paragraph">
      We do not use or process any personal information, because we do not collect any.
    </p>
  </section>`

const NO_DATA_LEGAL_BASIS_SECTION = `  <!-- Legal Basis -->
  <section id="legal-basis" class="section">
    <h2 class="subheading">Legal basis for information collection and processing</h2>
    <p class="paragraph">
      We do not collect or process any personal information, so no legal basis for processing applies.
    </p>
  </section>`

const NO_DATA_RETENTION_SECTION = `  <!-- Data Retention -->
  <section id="section-data-retention" class="section">
    <h2 class="subheading">Data retention</h2>
    <p class="paragraph">
      We do not retain any personal information, because we do not collect any.
    </p>
  </section>`

export function fixPrivacyHtml(source: string): FixResult {
    let html = source
    let total = 0
    const { html: afterApply, changed: applyCount } = apply(html, "privacy", [
        {
            find: "<Layout>",
            replace: '<Layout title="Privacy Policy">',
        },
        {
            find: "We process your information to provide you with the services you have requested or are interested in. We may also use your information for other purposes such as improving our services, communicating with you, security and compliance and law enforcement. All information is collected and processed for only valid legal reasons with your consent, which you can withdraw at any time.",
            replace: "We do not process any personal information, because we do not collect any.",
        },
    ])
    html = afterApply
    total += applyCount
    for (const [start, end, section] of [
        ["<!-- Use of Information -->", "<!-- Legal Basis -->", NO_DATA_USE_SECTION],
        ["<!-- Legal Basis -->", "<!-- Third Party Sharing -->", NO_DATA_LEGAL_BASIS_SECTION],
        ["<!-- Data Retention -->", "<!-- Data Breach Notification -->", NO_DATA_RETENTION_SECTION],
    ]) {
        const { html: next, changed } = replaceSection(html, "privacy", start, end, section)
        html = next
        total += changed
    }
    return { html, changed: total }
}

export function fixTermsHtml(source: string): FixResult {
    const { html, changed } = apply(source, "terms", [
        {
            find: "<Layout>",
            replace: '<Layout title="Terms of Service">',
        },
        {
            find: "You agree that in no event will our total liability to you for all damages, losses, and causes of action exceed the amount paid by you for a time period of  prior to the event.",
            replace:
                "Because the Service is provided free of charge, our total liability to you for all damages, losses, and causes of action shall not exceed the amount you paid for the Service.",
        },
        {
            find: "outside of the the core service proposition",
            replace: "outside of the core service proposition",
        },
        {
            find: '    <p class="paragraph">\n      \n    </p>\n    <p class="paragraph">\n      \n    </p>\n',
            replace: "",
        },
    ])
    return { html, changed }
}
