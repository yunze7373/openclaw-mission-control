/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["ws"],
};

export default nextConfig;
