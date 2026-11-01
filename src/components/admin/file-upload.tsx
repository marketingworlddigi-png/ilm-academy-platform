"use client";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { objectNameFor, UPLOAD_RULES, type UploadKind } from "@/modules/library/uploads";

type Props = {
  kind: UploadKind; resourceId: string; locale: string; label: string; current?: string | null;
  action: (fd: FormData) => Promise<void>;
};

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

/** Browser uploads straight to Supabase Storage (Workers have little memory), then tells the server to record it. */
export function FileUpload({ kind, resourceId, locale, label, current, action }: Props) {
  const rule = UPLOAD_RULES[kind];
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const accept = Object.keys(rule.mimes).join(",");

  function submit() {
    const file = input.current?.files?.[0];
    setMsg(null);
    if (!file) return setMsg("Choose a file first.");
    if (file.size > rule.maxBytes) return setMsg(`That file is too large. The limit is ${mb(rule.maxBytes)}.`);
    const name = objectNameFor(kind, resourceId, file.type);
    if (!name) return setMsg(`Unsupported file type. Allowed: ${Object.values(rule.mimes).join(", ")}.`);
    start(async () => {
      const { error } = await createClient().storage.from(rule.bucket).upload(name, file, { upsert: true, contentType: file.type });
      if (error) return setMsg("Upload failed. Check your connection and permissions, then try again.");
      const fd = new FormData();
      fd.set("locale", locale); fd.set("id", resourceId); fd.set("kind", kind); fd.set("path", name);
      await action(fd);
    });
  }

  return (
    <div>
      <label className="label" htmlFor={`up-${kind}`}>{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} id={`up-${kind}`} type="file" accept={accept} className="field max-w-sm" />
        <button type="button" className="btn btn-ghost" onClick={submit} disabled={pending}>{pending ? "Uploading..." : current ? "Replace" : "Upload"}</button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {current ? <>Current: {current.split("/").pop()}. </> : "Nothing uploaded yet. "}
        Up to {mb(rule.maxBytes)}; {Object.values(rule.mimes).join(", ")}.
      </p>
      {msg && <p role="alert" className="mt-1 text-sm text-danger">{msg}</p>}
    </div>
  );
}
