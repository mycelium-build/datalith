import * as v from "valibot"

/** The subset of `package-lock.json` (lockfile v3) that the license tooling reads. */
export const LockfileSchema = v.object({
    packages: v.record(
        v.string(),
        v.object({
            // Set only for aliased packages (`"vite": "npm:@voidzero-dev/vite-plus-core@…"`),
            // whose install path is the alias but whose license belongs to the real package name.
            name: v.optional(v.string()),
            version: v.optional(v.string()),
            dev: v.optional(v.boolean()),
            optional: v.optional(v.boolean()),
            devOptional: v.optional(v.boolean()),
        }),
    ),
})
