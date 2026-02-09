import type { NextConfig } from "next";
import { join } from "path";

const cwd = process.cwd();
const root = cwd.endsWith("chat-app") ? cwd : join(cwd, "chat-app");

if (process.cwd() !== root) {
  process.chdir(root);
}

const nextConfig: NextConfig = {
  turbopack: {
    root,
  },
};

export default nextConfig;
