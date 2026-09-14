import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitEasy",
    short_name: "SplitEasy",
    description: "Split bills, track shared spending, and organize your money.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/branding/app-icon.png", sizes: "1254x1254", type: "image/png", purpose: "any" }],
  };
}
