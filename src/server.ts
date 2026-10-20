import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod";

// The server's identity. Clients (Claude, Cursor, the Inspector) receive this
// during the initialization handshake.
const server = new McpServer({
  name: "notes",
  version: "0.1.0",
});

// A tool is a function the model can decide to call.
// - name: how the model refers to it ("add")
// - description: what the model reads to decide WHEN to use it — write it for the LLM
// - inputSchema: a zod schema; the SDK turns it into JSON Schema for the client
//   and validates incoming arguments before our handler ever runs
server.registerTool(
  "add",
  {
    title: "Add numbers",
    description: "Add two numbers and return the sum.",
    inputSchema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  },
  // The handler receives the already-validated arguments, with types inferred
  // from the schema. It returns a list of content blocks — text here, but
  // images, audio and resource links are also possible.
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }),
);

server.registerTool(
  "subtract",
  {
    title: "Subtract numbers",
    description: "Subtracts two numbers and return the result.",
    inputSchema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a - b) }],
  }),
);

// stdio transport: the client launches this process and exchanges JSON-RPC messages over stdin/stdout...
const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);

  // ...That means stdout belongs to the protocol — never console.log() here!
  // Instead, use console.error() for logs (it goes to stderr).
  console.error("all good!");
}

await main();
