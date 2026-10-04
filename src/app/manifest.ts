import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CampusOS — School Management Platform",
    short_name: "CampusOS",
    description:
      "Invite-based school & college management: classes, attendance, gradebook, fees, library, transport and communication in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF7",
    theme_color: "#0f172a",
    icons: [
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
