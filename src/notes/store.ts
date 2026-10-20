import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Plain storage layer: no MCP code here. Each note is a markdown file in
// NOTES_DIR whose first line is "# <title>" and the rest is the body.
//
// The path is resolved from this file's location, not the current working
// directory, because Claude/Cursor may launch the server from anywhere.
const NOTES_DIR =
  process.env.NOTES_DIR ?? path.join(import.meta.dirname, "../../data/notes");

export type Note = {
  id: string;
  title: string;
  body: string;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "café" -> "cafe"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parse(id: string, raw: string): Note {
  const [firstLine = "", ...rest] = raw.split("\n");
  return {
    id,
    title: firstLine.replace(/^#\s*/, ""),
    body: rest.join("\n").trim(),
  };
}

export async function addNote(title: string, body: string): Promise<Note> {
  const id = slugify(title);
  if (!id) throw new Error("Title must contain at least one letter or number");

  await mkdir(NOTES_DIR, { recursive: true });
  // "wx" fails if the file already exists, so we never overwrite a note.
  await writeFile(path.join(NOTES_DIR, `${id}.md`), `# ${title}\n\n${body}\n`, {
    flag: "wx",
  }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "EEXIST")
      throw new Error(`A note with id "${id}" already exists`);
    throw err;
  });

  return { id, title, body };
}

export async function listNotes(): Promise<Note[]> {
  const files = await readdir(NOTES_DIR).catch(() => [] as string[]);
  return Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map(async (file) => {
        const raw = await readFile(path.join(NOTES_DIR, file), "utf8");
        return parse(file.slice(0, -".md".length), raw);
      }),
  );
}

// Ids come from outside (e.g. a client asking for "notes://{id}"), so only
// accept the slug format we generate. This blocks path tricks like "../secrets".
const VALID_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getNote(id: string): Promise<Note | undefined> {
  if (!VALID_ID.test(id)) return undefined;
  try {
    const raw = await readFile(path.join(NOTES_DIR, `${id}.md`), "utf8");
    return parse(id, raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

// Replaces the title and/or body of an existing note. The id stays the same
// even if the title changes, so notes://{id} links keep working.
export async function updateNote(
  id: string,
  changes: { title?: string; body?: string },
): Promise<Note | undefined> {
  const current = await getNote(id);
  if (!current) return undefined;

  // Not `{ ...current, ...changes }`: a key that is present but undefined
  // (e.g. title when only body was sent) would wipe the current value.
  const updated = {
    id,
    title: changes.title ?? current.title,
    body: changes.body ?? current.body,
  };
  await writeFile(
    path.join(NOTES_DIR, `${id}.md`),
    `# ${updated.title}\n\n${updated.body}\n`,
  );
  return updated;
}

export async function searchNotes(query: string): Promise<Note[]> {
  const q = query.toLowerCase();
  const notes = await listNotes();
  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(q) ||
      note.body.toLowerCase().includes(q),
  );
}
