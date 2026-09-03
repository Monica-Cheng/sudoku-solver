import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sudoku/solver-core"],
};

export default nextConfig;
