import type { MetadataRoute } from "next";

// Allow everything: signed-in pages already redirect crawlers to /login, and disallowing them
// would only mark those pages "blocked from indexing".
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
