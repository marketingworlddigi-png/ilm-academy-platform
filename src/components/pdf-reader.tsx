"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; doc: PDFDocumentProxy };

/**
 * Renders a PDF page by page onto canvases. PDF.js is imported only in the browser, after the page loads, so it
 * never enters the server bundle. The signed URL lives 60 seconds, so the whole file is fetched once up front.
 */
export function PdfReader({ url }: { url: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? "expired" : "fetch");
        const data = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        task = pdfjs.getDocument({ data });
        const doc = await task.promise;
        if (cancelled) return void task.destroy();
        setState({ kind: "ready", doc });
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: e instanceof Error && e.message === "expired"
          ? "This reading link has expired. Reload the page to continue." : "The book could not be loaded. Please reload the page." });
      }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [url]);

  if (state.kind === "loading") return <p role="status" className="p-6 text-center text-ink-soft">Loading the book...</p>;
  if (state.kind === "error") return <p role="alert" className="p-6 text-center text-danger">{state.message}</p>;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">{state.doc.numPages} pages</p>
      <div className="flex flex-col items-center gap-4">
        {Array.from({ length: state.doc.numPages }, (_, i) => <PageCanvas key={i} doc={state.doc} number={i + 1} />)}
      </div>
    </div>
  );
}

/** A page is drawn only when it nears the viewport, so a 500-page book does not render 500 canvases at once. */
function PageCanvas({ doc, number }: { doc: PDFDocumentProxy; number: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.4);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let task: { cancel: () => void } | null = null;
    let drawn = false;
    const draw = async () => {
      drawn = true;
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const width = el.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      if (!c) return;
      c.width = viewport.width; c.height = viewport.height;
      c.style.width = "100%";
      const render = page.render({ canvas: c, viewport });
      task = render;
      await render.promise.catch(() => undefined);
    };
    const io = new IntersectionObserver((entries) => { if (!drawn && entries.some((e) => e.isIntersecting)) void draw(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => { io.disconnect(); task?.cancel(); };
  }, [doc, number]);

  return (
    <div ref={box} className="w-full max-w-3xl overflow-hidden rounded-md border border-line bg-white" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvas} aria-label={`Page ${number}`} />
    </div>
  );
}
