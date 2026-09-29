import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Automatic memoization: skips needless re-renders without hand-written useMemo/useCallback.
  reactCompiler: true,
  poweredByHeader: false,
};

export default nextConfig;
