import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this project so Next doesn't walk the entire
  // E:\arun\ folder tree (which can crash the build worker on Windows).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
