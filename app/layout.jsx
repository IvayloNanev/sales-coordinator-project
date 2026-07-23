import "./globals.css";
import { headers } from "next/headers";

export async function generateMetadata() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const title = "Sales Report Assistant";
  const description = "Consolidate, validate, and print manager-ready weekly sales reports.";
  return {
    title,
    description,
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: ["/favicon.svg"],
    },
    openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630, alt: "Sales Report Assistant workflow" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
