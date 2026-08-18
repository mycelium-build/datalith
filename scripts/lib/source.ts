import { execFile } from "node:child_process"
import { readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const DEFAULT_REPOSITORY = "mycelium-build/datalith-app"
const DEFAULT_SOURCE_REF = "main"
// Deterministic temp clone so every prebuild step shares one checkout instead of cloning the repository once per script.
// Reused across steps; replaced when the ref changes (stale marker).
const CLONE_DIRECTORY = path.join(os.tmpdir(), "datalith-site-source")
const CLONE_REF_MARKER = ".datalith-ref"

export interface DatalithSource {
    root: string
}

export function resolveLocalSource(): string {
    const sourceDir = process.env.DATALITH_SOURCE_DIR
    if (sourceDir) {
        if (process.env.CI) {
            throw new Error(
                "DATALITH_SOURCE_DIR must not be set in CI: documentation and assets are fetched with DATALITH_READ_TOKEN",
            )
        }
        return path.resolve(sourceDir)
    }
    return path.join(siteRoot, "..", "datalith")
}

export async function resolveDatalithSource(): Promise<DatalithSource> {
    if (process.env.DATALITH_SOURCE_DIR) {
        return { root: resolveLocalSource() }
    }

    const token = process.env.DATALITH_READ_TOKEN
    if (token) return cloneRepository(token)

    if (process.env.CI) {
        throw new Error("DATALITH_READ_TOKEN must be set in CI")
    }
    return { root: path.join(siteRoot, "..", "datalith") }
}

async function isUsableClone(ref: string): Promise<boolean> {
    try {
        const marker = await readFile(path.join(CLONE_DIRECTORY, CLONE_REF_MARKER), "utf8")
        await stat(path.join(CLONE_DIRECTORY, ".git"))
        return marker.trim() === ref
    } catch {
        return false
    }
}

async function cloneRepository(token: string): Promise<DatalithSource> {
    const repository = process.env.RELEASE_REPOSITORY ?? DEFAULT_REPOSITORY
    const ref = process.env.DATALITH_SOURCE_REF ?? DEFAULT_SOURCE_REF

    if (await isUsableClone(ref)) {
        console.log(`Reusing cloned ${repository}@${ref} at ${CLONE_DIRECTORY}`)
        return { root: CLONE_DIRECTORY }
    }

    await rm(CLONE_DIRECTORY, { recursive: true, force: true })
    await withCredentials(token, async (credentialFile) => {
        await execFileAsync("git", [
            "-c",
            `credential.helper=store --file=${credentialFile}`,
            "clone",
            "--depth",
            "1",
            "--single-branch",
            "--branch",
            ref,
            `https://github.com/${repository}.git`,
            CLONE_DIRECTORY,
        ])
    })
    await writeFile(path.join(CLONE_DIRECTORY, CLONE_REF_MARKER), ref)
    console.log(`Cloned ${repository}@${ref} into ${CLONE_DIRECTORY}`)
    return { root: CLONE_DIRECTORY }
}

async function withCredentials<T>(
    token: string,
    run: (credentialFile: string) => Promise<T>,
): Promise<T> {
    const credentialFile = path.join(os.tmpdir(), `datalith-git-credentials-${process.pid}`)
    await writeFile(credentialFile, `https://x-access-token:${token}@github.com\n`, { mode: 0o600 })
    try {
        return await run(credentialFile)
    } finally {
        await rm(credentialFile, { force: true })
    }
}
