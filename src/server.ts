import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

// The server's identity. Clients (Claude, Cursor, the Inspector) receive this
// during the initialization handshake.
const server = new McpServer({
  name: "notes",
  version: "0.1.0",
});

// stdio transport: the client launches this process and exchanges JSON-RPC messages over stdin/stdout...
const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);

  // ...That means stdout belongs to the protocol — never console.log() here!
  // Instead, use console.error() for logs (it goes to stderr).
  console.error("all good!");
}

await main();
