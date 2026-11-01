"use server";
import { createClient } from "@/lib/supabase/server";
import { boardSchema, idSchema, levelSchema, subjectSchema, uuidList } from "@/modules/catalog/schemas";
import { catalogErrorMessage, NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { finish, localeOf, raw } from "./action-utils";

// Every action uses the signed-in user's client: row-level security is the authority, so a non-admin who
// posts to these actions directly is rejected by the database no matter what this code does.

// ------------------------------------------------------------------ boards
export async function createBoard(fd: FormData) {
  const l = localeOf(fd);
  const p = boardSchema.safeParse(raw(fd));
  if (!p.success) finish(l, "/admin/boards", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("boards").insert(p.data!);
  if (error) finish(l, "/admin/boards", "error", catalogErrorMessage(error, "board"));
  finish(l, "/admin/boards", "notice", "Board saved.");
}

export async function updateBoard(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  const page = id.success ? `/admin/boards/${id.data}` : "/admin/boards";
  const p = boardSchema.safeParse(raw(fd));
  if (!id.success) finish(l, "/admin/boards", "error", "Invalid board.");
  if (!p.success) finish(l, page, "error", p.error.issues[0].message);
  const { data, error } = await (await createClient()).from("boards").update(p.data!).eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "board"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, page, "notice", "Board updated.");
}

export async function deleteBoard(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) finish(l, "/admin/boards", "error", "Invalid board.");
  const page = `/admin/boards/${id.data}`;
  if (fd.get("confirm") !== "on") finish(l, page, "error", "Tick the box to confirm deletion.");
  const { data, error } = await (await createClient()).from("boards").delete().eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "board"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, "/admin/boards", "notice", "Board deleted.");
}

// ------------------------------------------------------------------ levels
export async function createLevel(fd: FormData) {
  const l = localeOf(fd);
  const board = idSchema.safeParse(fd.get("board_id"));
  if (!board.success) finish(l, "/admin/boards", "error", "Invalid board.");
  const page = `/admin/boards/${board.data}`;
  const p = levelSchema.safeParse(raw(fd));
  if (!p.success) finish(l, page, "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("levels").insert(p.data!);
  if (error) finish(l, page, "error", catalogErrorMessage(error, "level"));
  finish(l, page, "notice", "Level added.");
}

export async function updateLevel(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  const p = levelSchema.safeParse(raw(fd));
  if (!id.success || !p.success) finish(l, "/admin/boards", "error", p.success ? "Invalid level." : p.error.issues[0].message);
  const page = `/admin/boards/${p.data!.board_id}/levels/${id.data}`;
  const { board_id: _keep, ...fields } = p.data!; // a level never moves between boards
  void _keep;
  const { data, error } = await (await createClient()).from("levels").update(fields).eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "level"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, page, "notice", "Level updated.");
}

export async function deleteLevel(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  const board = idSchema.safeParse(fd.get("board_id"));
  if (!id.success || !board.success) finish(l, "/admin/boards", "error", "Invalid level.");
  const page = `/admin/boards/${board.data}/levels/${id.data}`;
  if (fd.get("confirm") !== "on") finish(l, page, "error", "Tick the box to confirm deletion.");
  const { data, error } = await (await createClient()).from("levels").delete().eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "level"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, `/admin/boards/${board.data}`, "notice", "Level deleted.");
}

// ------------------------------------------------------------------ subjects
export async function createSubject(fd: FormData) {
  const l = localeOf(fd);
  const p = subjectSchema.safeParse(raw(fd));
  if (!p.success) finish(l, "/admin/subjects", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("subjects").insert(p.data!);
  if (error) finish(l, "/admin/subjects", "error", catalogErrorMessage(error, "subject"));
  finish(l, "/admin/subjects", "notice", "Subject saved.");
}

export async function updateSubject(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) finish(l, "/admin/subjects", "error", "Invalid subject.");
  const page = `/admin/subjects/${id.data}`;
  const p = subjectSchema.safeParse(raw(fd));
  if (!p.success) finish(l, page, "error", p.error.issues[0].message);
  const { data, error } = await (await createClient()).from("subjects").update(p.data!).eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "subject"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, page, "notice", "Subject updated.");
}

export async function deleteSubject(fd: FormData) {
  const l = localeOf(fd);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) finish(l, "/admin/subjects", "error", "Invalid subject.");
  const page = `/admin/subjects/${id.data}`;
  if (fd.get("confirm") !== "on") finish(l, page, "error", "Tick the box to confirm deletion.");
  const { data, error } = await (await createClient()).from("subjects").delete().eq("id", id.data!).select("id");
  if (error) finish(l, page, "error", catalogErrorMessage(error, "subject"));
  if (!data?.length) finish(l, page, "error", NOT_FOUND_OR_DENIED);
  finish(l, "/admin/subjects", "notice", "Subject deleted.");
}

// ------------------------------------------------------------------ level <-> subject links
/** Makes the level's subject set equal to the ticked boxes, changing only the difference. */
export async function setLevelSubjects(fd: FormData) {
  const l = localeOf(fd);
  const level = idSchema.safeParse(fd.get("level_id"));
  const board = idSchema.safeParse(fd.get("board_id"));
  if (!level.success || !board.success) finish(l, "/admin/boards", "error", "Invalid level.");
  const page = `/admin/boards/${board.data}/levels/${level.data}`;
  const wanted = new Set(uuidList(fd.getAll("subject_id")));
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase.from("level_subjects").select("subject_id").eq("level_id", level.data!);
  if (readErr) finish(l, page, "error", catalogErrorMessage(readErr, "subject link"));
  const have = new Set((current ?? []).map((r) => r.subject_id as string));
  const add = [...wanted].filter((s) => !have.has(s));
  const remove = [...have].filter((s) => !wanted.has(s));

  if (add.length) {
    const { error } = await supabase.from("level_subjects").insert(add.map((subject_id) => ({ level_id: level.data!, subject_id })));
    if (error) finish(l, page, "error", catalogErrorMessage(error, "subject link"));
  }
  if (remove.length) {
    const { error } = await supabase.from("level_subjects").delete().eq("level_id", level.data!).in("subject_id", remove);
    if (error) finish(l, page, "error", catalogErrorMessage(error, "subject link"));
  }
  finish(l, page, "notice", `Subjects updated (${add.length} added, ${remove.length} removed).`);
}
