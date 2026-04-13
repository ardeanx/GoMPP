import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter } from "next/font/google";
import { fa } from "zod/locales";

const inter = Inter({
  subsets: ["latin"],
});

const metadata = {
  title: "GoMPP Documentation",
  favicon: "/logo.webp",
  description:
    "Comprehensive documentation for GoMPP - the ultimate media processing platform.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <link rel="icon" href={metadata.favicon} />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
