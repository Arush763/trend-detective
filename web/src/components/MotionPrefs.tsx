"use client";
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** Turns off Motion's movement (keeps fades) for visitors who ask for reduced motion. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
