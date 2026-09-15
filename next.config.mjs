/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Azure Static Web Apps' hybrid Next.js (SSR) support —
  // without it, Azure's build/packaging of server routes into its
  // managed backend can behave unpredictably (see Microsoft Learn:
  // "Deploy hybrid Next.js websites on Azure Static Web Apps").
  output: "standalone",
};

export default nextConfig;
