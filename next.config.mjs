/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Azure Static Web Apps' hybrid Next.js (SSR) support —
  // without it, Azure's build/packaging of server routes into its
  // managed backend can behave unpredictably (see Microsoft Learn:
  // "Deploy hybrid Next.js websites on Azure Static Web Apps").
  output: "standalone",
  // Don't reuse a visited page's server data for 30s on back/forward navigation: Finance
  // screens (e.g. People Costs) would show the state from before a save until then.
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  webpack: (config, { isServer }) => {
    // lib/prisma.ts uses Node's `async_hooks` (for the multi-tenancy
    // AsyncLocalStorage context, 2026-10-23) — fine for server code, but
    // several "use client" components import a *different* export from
    // the same shared lib/*.ts module that also imports lib/prisma.ts
    // (e.g. a plain constant alongside DB-querying functions), which
    // drags the whole module — async_hooks included — into the client
    // bundle. Webpack has no browser polyfill for it and fails the build
    // outright. The actual tenant-context code is never called from
    // client-side JS (only from server components/API routes), so it's
    // safe to tell webpack to stub it out as unavailable for the client
    // compilation rather than restructure every such shared module.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, async_hooks: false };
    }
    return config;
  },
};

export default nextConfig;
