import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { addNote, listNotes, searchNotes, type Note } from "../notes/store.ts";

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
