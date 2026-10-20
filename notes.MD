### Open app for exploring mcp server

npm run inspect

### List tools

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/list

### Run "add" tool with args 2 and 4

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name add --tool-arg a=2 --tool-arg b=4

### Run "subtract" tool with args 52 and 40

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name subtract --tool-arg a=52 --tool-arg b=40

### Run add_note tool

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name add_note --tool-arg title="mercado" --tool-arg body="passar no mercado e comprar azeite"

### Run search_notes tool

mcp-test git:(master) ✗ npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name search_notes --tool-arg query="azeite"
