import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Automatic memoization: skips needless re-renders without hand-written useMemo/useCallback.
  reactCompiler: true,
  poweredByHeader: false,
  // The evals seed route reads the saved prompt files at run time.
  outputFileTracingIncludes: { "/api/evals/seed": ["./prompts/**/*"] },
};

export default nextConfig;
