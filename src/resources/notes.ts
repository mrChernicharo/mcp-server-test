import {
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/server";
import { getNote, listNotes } from "../notes/store.ts";

// Tools vs resources:
// - a tool is an ACTION the model decides to call (add_note, search_notes)
// - a resource is DATA identified by a URI, which the client app or the user
//   picks to put into the conversation as context (e.g. "@notes:..." in Claude Code)
export function registerNoteResources(server: McpServer) {
  server.registerResource(
    "note",
    // A template has variables, so a single registration covers every note:
    // notes://mercado, notes://cafe-ideas, ...
    // (A fixed URI string like "notes://index" would register a static resource instead.)
    new ResourceTemplate("notes://{id}", {
      // resources/list: lets clients show the user which notes exist.
      list: async () => {
        const notes = await listNotes();
        return {
          resources: notes.map((note) => ({
            uri: `notes://${note.id}`,
            name: note.id,
            title: note.title,
            mimeType: "text/markdown",
          })),
        };
      },
      // completion/complete: autocomplete for the {id} variable as the user types.
      complete: {
        id: async (value) => {
          const notes = await listNotes();
          return notes
            .map((note) => note.id)
            .filter((id) => id.startsWith(value));
        },
      },
    }),
    {
      title: "Note",
      description: "A markdown note saved with the add_note tool",
      mimeType: "text/markdown",
    },
    // resources/read: the SDK matches the URI against the template and hands us
    // the extracted variables.
    async (uri, { id }) => {
      const note = await getNote(String(id));
      // Unlike a tool error, a missing resource is a protocol error: there's no
      // model in the loop to read a message and retry, it's the client asking.
      if (!note) throw new ResourceNotFoundError(uri.href);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# ${note.title}\n\n${note.body}\n`,
          },
        ],
      };
    },
  );
}
