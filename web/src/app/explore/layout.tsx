import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore a place",
  description: "Pick a place and something to measure, then watch its trend face four checks that luck rarely passes.",
};

export default function ExploreLayout({ children }: LayoutProps<"/explore">) {
  return children;
}
