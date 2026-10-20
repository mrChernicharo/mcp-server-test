import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

export function registerMathTools(server: McpServer) {
  // server.registerTool;
  // server.registerTool(mathTools[0])
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
}

// const t = mathTools as unknown as {
//   name: string;
//   config: {
//     title?: string;
//     description?: string;
//     inputSchema?: z.ZodObject<
//       {
//         a: z.ZodNumber;
//         b: z.ZodNumber;
//       },
//       z.core.$strip
//     >;
//     outputSchema?: z.ZodObject<Record<string, z.ZodType>>;
//     annotations?: ToolAnnotations;
//     icons?: Icon[];
//     scopeChallenge?: ScopeChallengeHandler;
//     _meta?: Record<string, unknown>;
//   };
//   cb: ToolCallback<
//     z.ZodObject<
//       {
//         a: z.ZodNumber;
//         b: z.ZodNumber;
//       },
//       z.core.$strip
//     >
//   >;
// };
