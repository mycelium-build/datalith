import * as v from "valibot"

/** Validates `input` against `schema`, throwing an error that names `source` and every failing path. */
export function parseWith<const TSchema extends v.GenericSchema>(
    schema: TSchema,
    input: unknown,
    source: string,
): v.InferOutput<TSchema> {
    const result = v.safeParse(schema, input)
    if (!result.success) throw new Error(`${source} is invalid:\n${v.summarize(result.issues)}`)
    return result.output
}
