import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  addNote,
  listNotes,
  searchNotes,
  updateNote,
  type Note,
} from "../notes/store.ts";

function formatList(notes: Note[]): string {
  return notes.map((note) => `- ${note.id}: ${note.title}`).join("\n");
}

export function registerNoteTools(server: McpServer) {
  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description:
        "Save a new markdown note. The id is derived from the title, so titles must be unique.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Short title of the note"),
        body: z.string().describe("Note content in markdown"),
      }),
    },
    async ({ title, body }) => {
      try {
        const note = await addNote(title, body);
        // A new note means a new resource: tell connected clients to refresh
        // their resource list.
        server.sendResourceListChanged();
        return { content: [{ type: "text", text: `Saved note "${note.id}"` }] };
      } catch (err) {
        // Expected failures (like a duplicate title) go back to the model as a
        // tool error, so it can read the message and try something else.
        return {
          content: [{ type: "text", text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "update_note",
    {
      title: "Update note",
      description: `Replace the title and/or body of an existing note. Fields you omit stay as they are. The id never changes, even if the title does. To add to a note without losing its content, read it first and send the full new body.`,
      inputSchema: z
        .object({
          id: z.string().describe("Id of the note to update"),
          title: z.string().min(1).optional().describe("New title"),
          body: z.string().optional().describe("New body in markdown"),
        })
        // A refinement runs during validation like any other rule, so the
        // handler never sees a call with nothing to update.
        .refine((args) => args.title !== undefined || args.body !== undefined, {
          message: "Provide a new title, a new body, or both",
        }),
      // Overwrites existing content (destructive), but calling it twice with
      // the same arguments ends in the same state (idempotent).
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ id, title, body }) => {
      const note = await updateNote(id, { title, body });
      if (!note) {
        return {
          content: [
            {
              type: "text",
              text: `No note with id "${id}". Use list_notes to see the ids.`,
            },
          ],
          isError: true,
        };
      }

      // The title is part of resources/list, so a new title changes the list.
      if (title !== undefined) server.sendResourceListChanged();
      return { content: [{ type: "text", text: `Updated note "${note.id}"` }] };
    },
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description: "List all saved notes (id and title).",
      // Annotations are hints for the client. readOnlyHint tells it this tool
      // doesn't change anything, which some clients use when asking for
      // permission.
      annotations: { readOnlyHint: true },
    },
    async () => {
      const notes = await listNotes();
      const text = notes.length ? formatList(notes) : "No notes yet.";
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description:
        "Find notes whose title or body contains the query (case-insensitive).",
      inputSchema: z.object({
        query: z.string().min(1).describe("Text to look for"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const notes = await searchNotes(query);
      const text = notes.length
        ? formatList(notes)
        : `No notes match "${query}".`;
      return { content: [{ type: "text", text }] };
    },
  );
}
