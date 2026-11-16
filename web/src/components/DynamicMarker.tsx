import { Suspense } from "react";
import { connection } from "next/server";

// Under Cache Components, metadata that reads searchParams needs the page to say it is dynamic on purpose. This marker
// does that while the page shell still prerenders (Next.js docs: "generateMetadata and generateViewport").
async function Connection() {
  await connection();
  return null;
}

export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
