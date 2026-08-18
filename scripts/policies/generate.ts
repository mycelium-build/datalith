/**
 * Fixup step run in place after `policygen generate`.
 * Reads the generated pages, applies the no-data/template corrections, and rewrites them.
 */

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { fixPrivacyHtml, fixTermsHtml } from "./fixup.ts"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

const PRIVACY = path.join(ROOT, "src/pages/privacy/index.astro")
const TERMS = path.join(ROOT, "src/pages/terms/index.astro")

const privacySource = await readFile(PRIVACY, "utf-8")
const { html: privacyHtml, changed: privacyCount } = fixPrivacyHtml(privacySource)
if (privacyCount > 0) await writeFile(PRIVACY, privacyHtml, "utf-8")
console.log(`[fixup] privacy: ${privacyCount} replacement(s) applied`)

const termsSource = await readFile(TERMS, "utf-8")
const { html: termsHtml, changed: termsCount } = fixTermsHtml(termsSource)
if (termsCount > 0) await writeFile(TERMS, termsHtml, "utf-8")
console.log(`[fixup] terms: ${termsCount} replacement(s) applied`)
