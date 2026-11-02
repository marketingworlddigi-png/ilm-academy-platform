"use client";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROOF_BUCKET, PROOF_MAX_BYTES, PROOF_MIMES, proofObjectName } from "@/modules/payments/proofs";

type Props = { paymentId: string; userId: string; locale: string; action: (fd: FormData) => Promise<void> };

/** Uploads the proof straight to the private bucket from the browser (Workers have little memory), then submits the form. */
export function PaymentProofForm({ paymentId, userId, locale, action }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = file.current?.files?.[0];
    setMsg(null);
    if (!f) return setMsg("Choose a screenshot or receipt of your payment.");
    if (f.size > PROOF_MAX_BYTES) return setMsg("That file is too large. The limit is 5 MB.");
    const name = proofObjectName(userId, paymentId, f.type);
    if (!name) return setMsg("Unsupported file type. Upload a JPG, PNG, WebP or PDF.");
    const fd = new FormData(form);
    fd.set("locale", locale); fd.set("id", paymentId); fd.set("path", name);
    fd.delete("proof"); // the file itself goes to Storage, not through the server action
    start(async () => {
      const { error } = await createClient().storage.from(PROOF_BUCKET).upload(name, f, { upsert: true, contentType: f.type });
      if (error) return setMsg("Upload failed. Check your connection and try again.");
      await action(fd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="reference">Transaction ID</label>
        <input className="field" id="reference" name="reference" required minLength={6} maxLength={64} autoComplete="off" />
        <p className="mt-1 text-xs text-ink-soft">Exactly as shown on your receipt or SMS.</p>
      </div>
      <div>
        <label className="label" htmlFor="proof">Screenshot or receipt</label>
        <input ref={file} className="field" id="proof" name="proof" type="file" accept={Object.keys(PROOF_MIMES).join(",")} required />
        <p className="mt-1 text-xs text-ink-soft">JPG, PNG, WebP or PDF, up to 5 MB. Only you and our payment reviewers can see it.</p>
      </div>
      <div>
        <label className="label" htmlFor="note">Note (optional)</label>
        <input className="field" id="note" name="note" maxLength={500} />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Submitting..." : "Submit for review"}</button>
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
    </form>
  );
}
