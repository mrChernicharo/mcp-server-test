# Stage 1 recap: the notes MCP server

## 1. Overview

**MCP (Model Context Protocol)** is a standard way for an AI app to connect to outside capabilities. There are three roles:

| Role                                                      | Here                                |
| --------------------------------------------------------- | ----------------------------------- |
| **Host**: the AI app the user talks to                    | Claude Code, Cursor, Claude Desktop |
| **Client**: the part of the host that talks to one server | Created by the host, one per server |
| **Server**: provides the capabilities                     | Our `notes` server                  |

- **It's JSON-RPC 2.0.** Each request has an `id` and a `method`, and each response carries the same `id`. Responses can arrive out of order (we saw `id: 4` come back before `id: 3`). Notifications have no `id` and get no reply.
- **The transport is stdio.** The host starts the server as a child process and exchanges messages over stdin and stdout, one JSON message per line. Stage 3 adds HTTP.
- **The connection starts with a handshake.** The client sends `initialize`, and the server replies with its `serverInfo` and `capabilities`. The capabilities grew as we added features:
  `{}` → `tools` → `+ resources, completions` → `+ prompts`

## 2. The three features, and who uses each

| Feature       | Who uses it                            | What it is                                  | In this project                                                            |
| ------------- | -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| **Tools**     | The **model** decides when to call one | Actions that can have effects               | `add`, `subtract`, `add_note`, `update_note`, `list_notes`, `search_notes` |
| **Resources** | The **app or user** attaches one       | Data identified by a URI, read-only         | `notes://{id}`                                                             |
| **Prompts**   | The **user** picks one explicitly      | Ready-made messages to start a conversation | `plan_from_note`, `review_notes`                                           |

### Tools

- **`description` is written for the model.** It's how the model decides _when_ to use the tool.
- **`inputSchema` is a zod schema.** The SDK converts it to JSON Schema for the client and checks incoming arguments before your handler runs. The handler's argument types come from the schema automatically.
- **Results are a list of content blocks**: `{ content: [{ type: "text", text }] }`.
- **There are two kinds of errors:**
  - **Tool errors** (`isError: true`) go back to the _model_ as text, so it can fix its call and retry. We produce these for wrong argument types, duplicate titles and unknown ids.
  - **Protocol errors** (thrown) go to the _client app_.
- **Annotations are hints for the client:**
  - `readOnlyHint`: the tool doesn't change anything (`list_notes`, `search_notes`).
  - `destructiveHint`: the tool can overwrite or delete data.
  - `idempotentHint`: repeating the same call gives the same result (`update_note`).
- **`.refine()` rules are checked but don't appear in the JSON Schema.** The model can't see them, so explain them in the `description`.

### Resources

- **A static resource has a fixed URI.** A **template** like `notes://{id}` covers many resources with one registration.
- A template can have three handlers:
  - `list`: answers `resources/list`, so clients can show which notes exist.
  - `complete`: autocompletes `{id}` as the user types (`completion/complete`).
  - The read handler: the SDK matches the URI against the template and passes you the extracted variables.
- **A missing resource throws `ResourceNotFoundError`**, a protocol error. There's no model in the loop to read an error message and retry.
- **Treat URIs as untrusted input.** `getNote` only accepts ids in our own format, which blocks path tricks like `../../package`.
- **Notifications:** `sendResourceListChanged()` sends `notifications/resources/list_changed`, telling clients to fetch the list again. We send it when a note is added or a title changes.

### Prompts

- **A prompt doesn't run anything.** It returns `messages`, the client puts them in the conversation, and the model responds to them.
- **Messages can include a resource** (`type: "resource"`), so the model gets the note's content without calling a tool.
- **Arguments are always strings**, because users type them. `completable()` adds autocomplete.
- **No `argsSchema`** means the handler takes only the context (`review_notes`).

## 3. Project structure

```
mcp-test/
├── .mcp.json              # tells Claude Code how to start the server
├── notes.MD               # command cheat sheet
├── LEARNINGS.md           # this file
├── package.json           # scripts: start, typecheck, inspect
├── tsconfig.json          # type checking only (noEmit)
├── data/notes/*.md        # the notes themselves (gitignored)
└── src/
    ├── server.ts          # creates the server, registers everything, connects stdio
    ├── notes/store.ts     # file storage: add/get/update/list/search, no MCP code
    ├── tools/math.ts      # add, subtract
    ├── tools/notes.ts     # add_note, update_note, list_notes, search_notes
    ├── resources/notes.ts # notes://{id} template: list, complete, read
    └── prompts/notes.ts   # plan_from_note, review_notes
```

**How it works:**

1. `server.ts` creates the `McpServer`.
2. Each module's `register*()` function adds its tools, resources or prompts.
3. `server.connect(new StdioServerTransport())` starts listening.
4. When a request like `tools/call add_note` arrives, the SDK checks the arguments, calls the handler, the handler calls `store.ts`, and the result is sent back as JSON-RPC.

**Design choices:**

- **The storage layer has no MCP code.** The same functions back the tools, the resources and the prompts.
- **Each note is a plain markdown file.** The file name is the note's id, made from the title. The first line is `# title`, and the rest is the body.
- **The id never changes**, even when the title does, so links keep working.
- **The notes folder is found relative to the code file**, not the folder the server is started from. Hosts can start the server from anywhere. You can change it with `NOTES_DIR`.

**Stack:**

- **v2 MCP SDK** (`@modelcontextprotocol/server`). Most tutorials online still show v1's `@modelcontextprotocol/sdk` imports.
- **zod 4** for schemas.
- **Node 24 runs `.ts` files directly**, so there's no build step and `tsc` only checks types. Two consequences: local imports need the `.ts` extension, and you can't use TypeScript-only syntax that has to be compiled away, like `enum`.

## 4. How to test it

| Method                      | Command                                                                               | Best for                                |
| --------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------- |
| **Raw JSON-RPC**            | `printf '{"jsonrpc":"2.0","id":1,"method":"initialize",...}\n' \| node src/server.ts` | Seeing the actual protocol messages     |
| **Inspector, browser UI**   | `npm run inspect`, then click **Connect**                                             | Exploring and clicking through features |
| **Inspector, command line** | `npx @modelcontextprotocol/inspector --cli node src/server.ts --method <method> ...`  | Quick repeatable checks                 |
| **Real host**               | `.mcp.json`, then a new Claude Code conversation                                      | Seeing a model actually use the server  |

Inspector command-line examples (add these after `npx @modelcontextprotocol/inspector --cli node src/server.ts`):

```bash
--method tools/list
--method tools/call --tool-name add_note --tool-arg title="x" --tool-arg body="y"
--method resources/list
--method resources/read --uri notes://mercado
--method prompts/get --prompt-name plan_from_note --prompt-args id=mercado
-e NOTES_DIR=/some/dir    # set environment variables for the server; it doesn't see your shell's
```

**In Claude Code:**

- `/mcp` shows the server's status and lets you reconnect it.
- Ask it in plain language to use the tools.
- Type `@` to attach a note as a resource.
- Run `/mcp__notes__plan_from_note mercado` to use a prompt.
- After changing server code, **reconnect or start a new conversation**.

## 5. Gotchas

- **`console.log` in a stdio server breaks the protocol.** stdout carries the messages, so log with `console.error`.
- **Use absolute paths in host configs**, including for `node`. Desktop apps don't share your shell's PATH.
- **Every Inspector `--tool-arg` needs its `--`.** Without it, the argument is passed to the server command instead and silently dropped.
- **The Inspector doesn't pass your environment variables through.** Use `-e`.
- **`{ ...current, ...changes }` erases fields when a key is present but `undefined`.** Use `??`.
- **zsh doesn't split `$VAR` into words** the way bash does. Wrap a repeated command in a shell function instead of a variable.

## Next

- **Stage 2:** our own MCP client and tool-calling loop (needs an `ANTHROPIC_API_KEY`).
- **Stage 3:** HTTP transport, elicitation and sampling.
- **Stage 4:** A2A agents.
