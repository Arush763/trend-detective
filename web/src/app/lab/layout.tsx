import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fool the detector",
  description: "Hide a trend in random noise, or fake one, and watch the same tests that check every NASA case catch you, or get fooled.",
};

export default function LabLayout({ children }: LayoutProps<"/lab">) {
  return children;
}
