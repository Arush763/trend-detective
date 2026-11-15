import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Same cause, opposite effects",
  description: "Rain fell in the Amazon and rose over the Himalaya and Tibet, while both got warmer and moister. Compare any two places' NASA trends side by side.",
};

export default function CompareLayout({ children }: LayoutProps<"/compare">) {
  return children;
}
