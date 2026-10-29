import { defineRouteMiddleware } from "@astrojs/starlight/route-data"

export const onRequest = defineRouteMiddleware((context) => {
    const route = context.locals.starlightRoute
    const preview = route.entry.id.startsWith("docs/preview/")
    route.sidebar = route.sidebar.filter(
        (group) => group.label === (preview ? "Preview documentation" : "Datalith documentation"),
    )
    // The generated pagination may otherwise cross the channel boundary.
    for (const direction of ["prev", "next"] as const) {
        const link = route.pagination[direction]
        if (link && link.href.includes("/docs/preview/") !== preview) {
            route.pagination[direction] = undefined
        }
    }
})
