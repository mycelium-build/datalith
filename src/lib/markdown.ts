import { Marked } from "marked"

import { escapeHtml, sanitizeHtml } from "./html"

export type RouteResolver = (target: string) => string | null

const WIKILINK = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/

const rendererCache = new WeakMap<RouteResolver, Marked>()

function createRenderer(resolver: RouteResolver): Marked {
    const md = new Marked({ gfm: true, breaks: false })
    md.use({
        extensions: [
            {
                name: "wikilink",
                level: "inline",
                start(src: string) {
                    return src.indexOf("[[")
                },
                tokenizer(src: string) {
                    const match = WIKILINK.exec(src)
                    if (!match) return undefined
                    return {
                        type: "wikilink",
                        raw: match[0],
                        target: match[1],
                        label: match[2] ?? match[1],
                        inner: match[0].slice(2, -2),
                    }
                },
                renderer(token) {
                    const target = token.target
                        .trim()
                        .replace(/^\.\//, "")
                        .replace(/\.(md|todotxt|graph)$/i, "")
                    const route = resolver(target)
                    if (route) {
                        return `<a href="${escapeHtml(route)}">${escapeHtml(token.label)}</a>`
                    }
                    return `<span class="unresolved">[[${escapeHtml(token.inner)}]]</span>`
                },
            },
        ],
    })
    return md
}

export function renderMarkdown(source: string, resolver: RouteResolver = () => null): string {
    let md = rendererCache.get(resolver)
    if (!md) {
        md = createRenderer(resolver)
        rendererCache.set(resolver, md)
    }
    return sanitizeHtml(md.parse(source, { async: false }))
}
