### Open app for exploring mcp server

npm run inspect

### List tools

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/list

### Run "add" tool with args 2 and 4

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name add --tool-arg a=2 --tool-arg b=4

### Run "subtract" tool with args 52 and 40

npx @modelcontextprotocol/inspector --cli node src/server.ts --method tools/call --tool-name subtract --tool-arg a=52 --tool-arg b=40
