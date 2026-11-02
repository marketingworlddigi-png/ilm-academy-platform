"use client";
import dynamic from "next/dynamic";

// ssr:false keeps PDF.js (and its server-side copy) out of the Worker bundle; it is fetched only when a reader opens a book.
export const PdfReader = dynamic(() => import("./pdf-reader").then((m) => m.PdfReader), {
  ssr: false,
  loading: () => <p role="status" className="p-6 text-center text-ink-soft">Loading the reader...</p>,
});
