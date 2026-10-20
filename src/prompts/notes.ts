import {
  completable,
  ResourceNotFoundError,
  type McpServer,
} from "@modelcontextprotocol/server";
import * as z from "zod";
import { getNote, listNotes, type Note } from "../notes/store.ts";

// The third building block. Tools are called by the model, resources are
// attached by the app/user, and prompts are message templates the USER picks
// explicitly — in Claude Code they show up as slash commands like
// /mcp__notes__plan_from_note.
//
// A prompt doesn't run anything: it returns messages that the client drops
// into the conversation, and the model takes it from there.

// Prompt messages can embed a resource directly, so the model gets the note's
// content along with its URI instead of having to fetch it.
function noteAsResource(note: Note) {
  return {
    type: "resource" as const,
    resource: {
      uri: `notes://${note.id}`,
      mimeType: "text/markdown",
      text: `# ${note.title}\n\n${note.body}\n`,
    },
  };
}

export function registerNotePrompts(server: McpServer) {
  server.registerPrompt(
    "plan_from_note",
    {
      title: "Plan from note",
      description: "Turn a note into a concrete, step-by-step action plan",
      // Prompt arguments are always strings in MCP (users type them in).
      // completable() adds autocomplete for the argument, like we did for the
      // resource template's {id}.
      argsSchema: z.object({
        id: completable(
          z.string().describe("Id of the note"),
          async (value) => {
            const notes = await listNotes();
            return notes
              .map((note) => note.id)
              .filter((id) => id.startsWith(value));
          },
        ),
      }),
    },
    async ({ id }) => {
      const note = await getNote(id);
      if (!note) throw new ResourceNotFoundError(`notes://${id}`);

      return {
        description: `Action plan for "${note.title}"`,
        messages: [
          { role: "user", content: noteAsResource(note) },
          {
            role: "user",
            content: {
              type: "text",
              text: `Turn the note above into an action plan: a short list of concrete, ordered steps, each small enough to finish in one sitting. Point out anything in the note that is unclear or missing.`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "review_notes",
    {
      title: "Review all notes",
      description: "Summarize every note and pull out open to-dos",
    },
    // No argsSchema, so the callback receives only the context.
    async () => {
      const notes = await listNotes();
      return {
        messages: [
          ...notes.map((note) => ({
            role: "user" as const,
            content: noteAsResource(note),
          })),
          {
            role: "user",
            content: {
              type: "text",
              text: notes.length
                ? `Above are all my notes. Summarize them in a few bullets, group related ones, and list every open to-do you can find.`
                : `I have no notes yet. Suggest three notes I could start with.`,
            },
          },
        ],
      };
    },
  );
}
