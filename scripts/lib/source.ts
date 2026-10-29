import { execFile } from "node:child_process"
import { readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const DEFAULT_REPOSITORY = "mycelium-build/datalith-app"
const DEFAULT_SOURCE_REF = "main"
// Deterministic temp clone so every prebuild step shares one checkout instead of cloning the repository once per script.
// Reused across steps; replaced when the ref changes (stale marker).
const CLONE_DIRECTORY = path.join(os.tmpdir(), "datalith-source")
const CLONE_REF_MARKER = ".datalith-ref"

export interface DatalithSource {
    root: string
}

/** Local application checkout from DATALITH_SOURCE_DIR, for testing uncommitted assets. */
export function resolveLocalSource(): string | undefined {
    const sourceDir = process.env.DATALITH_SOURCE_DIR
    if (!sourceDir) return undefined
    if (process.env.CI) {
        throw new Error("DATALITH_SOURCE_DIR must not be set in CI: assets are cloned from the ref")
    }
    return path.resolve(sourceDir)
}

/** Assets source: the local checkout when set, otherwise a clone of DATALITH_SOURCE_REF. */
export async function resolveDatalithSource(): Promise<DatalithSource> {
    const local = resolveLocalSource()
    if (local) return { root: local }
    return cloneRepository(process.env.DATALITH_SOURCE_REF ?? DEFAULT_SOURCE_REF, CLONE_DIRECTORY)
}

/** Documentation source: always a clone of the release tag, never a working tree. */
export async function resolveTagSource(tag: string): Promise<DatalithSource> {
    return cloneRepository(tag, path.join(os.tmpdir(), `datalith-source-${tag}`))
}

async function isUsableClone(directory: string, ref: string): Promise<boolean> {
    try {
        const marker = await readFile(path.join(directory, CLONE_REF_MARKER), "utf8")
        await stat(path.join(directory, ".git"))
        return marker.trim() === ref
    } catch {
        return false
    }
}

async function cloneRepository(ref: string, directory: string): Promise<DatalithSource> {
    const repository = process.env.RELEASE_REPOSITORY ?? DEFAULT_REPOSITORY

    if (await isUsableClone(directory, ref)) {
        console.log(`Reusing cloned ${repository}@${ref} at ${directory}`)
        return { root: directory }
    }

    await rm(directory, { recursive: true, force: true })
    const clone = (gitConfig: string[]) =>
        execFileAsync("git", [
            ...gitConfig,
            "clone",
            "--depth",
            "1",
            "--single-branch",
            "--branch",
            ref,
            `https://github.com/${repository}.git`,
            directory,
        ])
    const token = process.env.DATALITH_READ_TOKEN
    if (token) {
        await withCredentials(token, (credentialFile) =>
            clone(["-c", `credential.helper=store --file=${credentialFile}`]),
        )
    } else {
        await clone([])
    }
    await writeFile(path.join(directory, CLONE_REF_MARKER), ref)
    console.log(`Cloned ${repository}@${ref} into ${directory}`)
    return { root: directory }
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
