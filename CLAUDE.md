# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Build the project and copy assets
npm run build

# Watch mode for development
npm run dev

# Clean build artifacts
npm run clean

# Run before publishing (clean + build)
npm run prepublishOnly
```

## Project Architecture

This is an n8n community nodes package that provides Upstage Solar LLM and embeddings integration. The project exports four n8n nodes:

### Core Components

1. **Credentials** (`src/credentials/UpstageApi.credentials.ts`)
   - Handles Upstage API key authentication

2. **Basic n8n Nodes** (for simple workflow usage)
   - `LmChatUpstage` - Basic chat completions
   - `EmbeddingsUpstage` - Basic embeddings generation

3. **LangChain-Compatible Nodes** (for advanced AI agent workflows)
   - `LmChatModelUpstage` - Extends ChatOpenAI with custom Upstage configuration
   - `EmbeddingsUpstageModel` - Custom LangChain Embeddings implementation

### Key Technical Details

- **API Endpoints**:
  - Chat: `https://api.upstage.ai/v1/solar/chat/completions`
  - Embeddings: `https://api.upstage.ai/v1/embeddings`

- **Model Limits**:
  - Embeddings: Max 100 strings per request, 204,800 total tokens
  - Each text: Under 4000 tokens (optimal: under 512)

- **Node Registration**: All nodes exported via `src/index.ts` and registered in `package.json` under the `n8n` field

- **Asset Handling**: SVG icons must be copied to dist during build (see `copy-assets` script)

### Development Patterns

- Use INodeType interface for basic nodes
- Implement `supplyData` method for LangChain-compatible nodes
- Return proper NodeConnectionType outputs (AiLanguageModel, AiEmbedding)
- Handle N8n tracing callbacks when available (see N8nLlmTracing usage)

## Testing

No automated tests are currently configured. Manual testing in n8n instance recommended:

1. Enable community nodes: `export N8N_COMMUNITY_NODES_ENABLED=true`
2. Install locally: `npm link` in project, then `npm link n8n-nodes-upstage` in n8n
3. Test all four nodes with valid Upstage API credentials