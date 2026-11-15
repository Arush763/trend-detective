"use client";
import { useState } from "react";
import { Card } from "./ui";

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** "Use this case": copy a link to it, download its numbers as CSV, and a ready-made citation. */
export function ShareTools({ title, filename, header, rows, notes }: {
  title: string;                       // what this case is, for the citation
  filename: string;                    // without .csv
  header: string[];
  rows: (string | number | null)[][];
  notes: string[];                     // written above the table as # comment lines (source, units, method)
}) {
  const [copied, setCopied] = useState("");
  const link = () => window.location.href;
  const year = new Date().getFullYear();
  const cite = `Trend Detective (${year}). ${title}. Data: NASA GMAO MERRA-2 monthly reanalysis via NASA GES DISC. ${typeof window === "undefined" ? "https://trend-detective.vercel.app" : link()}`;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied("error"); }
    window.setTimeout(() => setCopied(""), 2000);
  };
  const download = () => {
    const lines = [...notes.map((n) => `# ${n}`), `# Cite: ${cite}`, header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${filename}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-normal">Use this case</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pill" onClick={() => copy(link(), "link")}>{copied === "link" ? "Link copied ✓" : "Copy link"}</button>
        <button type="button" className="pill" onClick={download}>Download the data (CSV)</button>
        <button type="button" className="pill" onClick={() => copy(cite, "cite")}>{copied === "cite" ? "Citation copied ✓" : "Copy citation"}</button>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--muted)]">{cite}</p>
      <p className="sr-only" aria-live="polite">{copied === "error" ? "Couldn't copy. Select the text above instead." : copied ? `${copied === "link" ? "Link" : "Citation"} copied.` : ""}</p>
    </Card>
  );
}
