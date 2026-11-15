import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Globe",
  description: "Every 2° × 2.5° square of the planet on a 3D globe: the simple test, the luck test with shuffled data, and the strict test that survives.",
};

export default function GlobeLayout({ children }: LayoutProps<"/globe">) {
  return children;
}
