# n8n-nodes-upstage

[![npm version](https://img.shields.io/npm/v/n8n-nodes-upstage.svg)](https://www.npmjs.com/package/n8n-nodes-upstage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Upstage Solar LLM and Embeddings nodes for n8n workflow automation. This package provides powerful AI capabilities including chat completions, embeddings generation, and document processing through n8n's visual workflow interface.

## Features

- **Solar Chat Models**: Use Upstage's Solar LLM (solar-mini, solar-pro, solar-pro2) for chat completions
- **Embeddings Generation**: Create high-quality embeddings for semantic search and vector databases
- **Document Processing**: Parse, OCR, classify, and extract information from documents
- **AI Agent Integration**: Compatible nodes for n8n AI Agent and Vector Store workflows (no external dependencies)
- **Secure Authentication**: Simple API key-based authentication
- **Batch Processing**: Efficient batch processing for embeddings and document operations
- **Flexible Input**: Support for single text, batch processing, binary files, and URLs

## Installation

### Prerequisites

- **n8n**: Version 1.0.0 or later
- **Node.js**: Version 18.0.0 or later

### Install via n8n UI (Recommended)

1. Enable Community Nodes (if not already enabled):
   ```bash
   export N8N_COMMUNITY_NODES_ENABLED=true
   n8n start
   ```

2. Install via n8n UI:
   - Open n8n in your browser
   - Navigate to **Settings** → **Community Nodes**
   - Click **Install a community node**
   - Enter: `n8n-nodes-upstage`
   - Click **Install**

### Install via npm (Alternative)

```bash
npm install n8n-nodes-upstage
```

Then enable community nodes and restart n8n:
```bash
export N8N_COMMUNITY_NODES_ENABLED=true
n8n start
```

## Quick Start

### 1. Get Your API Key

1. Sign up at [Upstage Console](https://console.upstage.ai/)
2. Navigate to **API Keys** section
3. Create a new API key
4. Copy your API key

### 2. Configure Credentials in n8n

1. In n8n, go to **Credentials** → **Create New**
2. Search for **"Upstage API"**
3. Enter your API key
4. Click **Test** to verify the connection
5. Click **Save**

### 3. Use the Nodes

1. Create a new workflow in n8n
2. Click **Add Node** and search for "Upstage"
3. Select any Upstage node (e.g., "Upstage Solar Chat")
4. Configure the node with your credentials
5. Set up your workflow and execute!

## Available Nodes

### Basic Nodes

#### Upstage Solar Chat (`LmChatUpstage`)

Use Upstage Solar LLM models for chat completions with conversation support.

**Supported Models:**
- `solar-mini` - Fast and efficient for basic tasks
- `solar-pro` - Powerful model for complex tasks  
- `solar-pro2` - Latest and most advanced Solar model with JSON support

**Key Features:**
- Message-based conversation format (system, user, assistant roles)
- Configurable parameters: temperature, max tokens, top-p
- Streaming response support
- Response format options (solar-pro2 only):
  - Text (default)
  - JSON Object - Generate structured JSON responses
  - JSON Schema - Generate JSON with custom schema for structured outputs
- Reasoning effort control
- Frequency and presence penalty
- Function calling support (tools)

**Example Use Cases:**
- Customer support chatbots
- Content generation
- Code generation and explanation
- Data extraction and analysis

#### Upstage Embed (`EmbeddingsUpstage`)

Generate high-quality embeddings using Solar embedding models for semantic search and similarity matching.

**Supported Models:**
- `embedding-query` - Optimized for search queries and questions
- `embedding-passage` - Optimized for documents and passages

**Key Features:**
- Single text or batch processing (up to 100 texts per request)
- Input from node parameters or previous node data
- High-dimensional vector outputs
- Token limits: Max 204,800 total tokens, 4,000 per text (optimal: under 512)

**Example Use Cases:**
- Semantic search
- Document similarity matching
- Clustering and classification
- Recommendation systems

#### Upstage Document Parse (`DocumentParsingUpstage`)

Convert documents into structured HTML/Markdown format with layout preservation.

**Supported Models:**
- `document-parse` - Recommended stable model
- `document-parse-nightly` - Latest experimental features

**Key Features:**
- Sync and async document processing
- Multiple output formats (HTML, Markdown, Text)
- OCR support with auto/force modes
- Chart recognition and table merging
- Base64 encoding for figures, tables, equations, charts
- Coordinate information inclusion

**Supported Formats:**
- Images: JPEG, PNG, BMP, TIFF, HEIC
- Documents: PDF, DOCX, PPTX, XLSX

**Example Use Cases:**
- Document digitization
- Content extraction from PDFs
- Table extraction and conversion
- Document structure analysis

#### Upstage Document OCR (`DocumentOCRUpstage`)

Extract text from document images and PDFs with high accuracy.

**Supported Models:**
- `ocr` - Recommended (always points to latest stable)
- `ocr-250904` - Specific version

**Key Features:**
- Multiple OCR models
- Schema options (Upstage, Clova, Google)
- Page-level text extraction
- Confidence scores
- Multiple return modes (full, text, pages, words, confidence)

**Supported Formats:**
- Images: JPEG, PNG, BMP, TIFF, HEIC
- Documents: PDF, DOCX, PPTX, XLSX, HWP, HWPX

**Example Use Cases:**
- Text extraction from scanned documents
- Invoice and receipt processing
- Form data extraction
- Multi-language OCR

#### Upstage Information Extract (`InformationExtractionUpstage`)

Extract structured information from documents using custom JSON schemas.

**Supported Models:**
- `information-extract` - Recommended

**Key Features:**
- Custom JSON schema definition
- Form-based or raw JSON schema input
- Support for nested structures
- Schema generation mode
- Binary file or URL input

**Example Use Cases:**
- Invoice data extraction
- Resume parsing
- Contract analysis
- Form data extraction

#### Upstage Document Classify (`DocumentClassificationUpstage`)

Classify documents into predefined categories with confidence scores.

**Supported Models:**
- `document-classify` - Document classification model

**Key Features:**
- Custom category definitions
- Binary file or URL input
- Form-based or JSON schema input
- Confidence scores for classifications

**Example Use Cases:**
- Document type classification
- Spam detection
- Content categorization
- Quality control

### AI Agent Nodes (n8n AI Workflows)

#### Upstage Solar Chat for Agent (`LmChatModelUpstage`)

Language model for use with n8n AI Chain and AI Agent nodes. Implements the n8n Language Model interface without external dependencies.

**Key Features:**
- Automatic model selection from API
- Token usage tracking
- Streaming support (basic)
- Response format options (solar-pro2 only):
  - Text (default)
  - JSON Object - Generate structured JSON responses
  - JSON Schema - Generate JSON with custom schema for structured outputs
- Function calling support (tools) - Bind tools to the model
- N8n tracing integration
- Direct HTTP API calls (no external dependencies)

**Connections:**
- Connects to: `AI Chain`, `AI Agent` nodes
- Output: Language Model

**Example Use Cases:**
- AI agent workflows
- Multi-step reasoning
- Tool-using agents
- Complex AI chains

#### Upstage Embed for Agent (`EmbeddingsUpstageModel`)

Embeddings model for vector databases and AI agent workflows. Implements the n8n Embeddings interface without external dependencies.

**Key Features:**
- Embeddings interface compatible with n8n AI Vector Store
- Batch processing support
- Vector database integration
- Automatic text preprocessing
- Direct HTTP API calls (no external dependencies)

**Connections:**
- Connects to: `AI Vector Store` nodes
- Output: Embeddings

**Example Use Cases:**
- RAG (Retrieval-Augmented Generation) workflows
- Vector database population
- Semantic search in AI agents
- Document similarity in agents

## Usage Examples

### Simple Chat Completion

1. Add **Upstage Solar Chat** node
2. Configure with your Upstage API credentials
3. Set model to `solar-mini`
4. Add a message with role "user" and your prompt
5. Execute to get AI response

### Text Embeddings

1. Add **Upstage Embed** node
2. Configure credentials
3. Choose appropriate model (query vs passage)
4. Input your text
5. Get embedding vectors for similarity search, clustering, etc.

### Batch Processing

Use the **Upstage Embed** node with "Array of Texts" input type to process multiple texts efficiently in a single API call.

### Document Parsing Workflow

1. **Read Binary File** node → Read PDF
2. **Upstage Document Parse** node → Parse to Markdown
3. Process the structured output

### AI Agent Workflow

1. **Upstage Solar Chat for Agent** → Configure model
2. **AI Agent** node → Connect to chat model
3. **Upstage Embed for Agent** → Connect to vector store
4. Build complex AI workflows

### Structured JSON Output (Response Format)

Use response format options to get structured JSON responses from the model:

1. Add **Upstage Solar Chat** or **Upstage Solar Chat for Agent** node
2. Select `solar-pro2` model
3. In Options, set **Response Format** to:
   - **JSON Object**: For simple JSON responses (requires "JSON" in prompt)
   - **JSON Schema**: For custom structured outputs with your own schema
4. If using JSON Schema, provide your JSON schema definition
5. Execute to get structured JSON response

**Example JSON Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "email": { "type": "string" }
  },
  "required": ["name", "email"]
}
```

## Configuration

### API Endpoints

- **Chat**: `https://api.upstage.ai/v1/chat/completions`
- **Embeddings**: `https://api.upstage.ai/v1/embeddings`
- **Document Parsing**: `https://api.upstage.ai/v1/document-digitization`
- **Document OCR**: `https://api.upstage.ai/v1/ocr`
- **Information Extraction**: `https://api.upstage.ai/v1/information-extraction`
- **Document Classification**: `https://api.upstage.ai/v1/document-classify`

### Rate Limits

Please refer to [Upstage API Documentation](https://developers.upstage.ai/docs/apis) for current rate limits and usage guidelines.

### Model Limits

- **Embeddings**: 
  - Max 100 strings per request
  - Max 204,800 total tokens per request
  - Max 4,000 tokens per text (optimal: under 512 tokens)
- **Chat**: 
  - Max tokens vary by model (check model documentation)
  - Context windows: 2,048 to 32,768 tokens depending on model

## API Reference

- [Upstage Chat API Documentation](https://developers.upstage.ai/docs/apis/chat)
- [Upstage Embeddings API Documentation](https://console.upstage.ai/docs/capabilities/embeddings)
- [Upstage Document APIs Documentation](https://developers.upstage.ai/docs/apis/document-apis)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## Troubleshooting

### Node Not Visible

1. Verify community nodes are enabled: `N8N_COMMUNITY_NODES_ENABLED=true`
2. Restart n8n completely
3. Clear browser cache
4. Check n8n logs for installation errors
5. Verify the package is properly installed: `npm list n8n-nodes-upstage`

### API Errors

1. **Invalid API Key**: Verify your API key is correct and active
2. **Rate Limit**: Check if you've exceeded API rate limits
3. **Network Issues**: Verify network connectivity to `api.upstage.ai`
4. **Model Availability**: Ensure the selected model is available in your region

### Common Issues

**Error: "At least one message is required"**
- Ensure you've added at least one message in the chat node

**Error: "No input text provided"**
- Check that text input is not empty
- Verify the text field name matches your input data

**Error: "Invalid JSON schema"**
- Validate your JSON schema syntax
- Ensure the schema follows the required format

**Document Processing Fails**
- Verify the file format is supported
- Check file size limits
- Ensure binary property name is correct

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/UpstageAI/n8n-nodes-upstage.git
cd n8n-nodes-upstage

# Install dependencies
npm install

# Build the project
npm run build

# Run in watch mode
npm run dev
```

### Testing Locally

```bash
# Build and create npm link
npm run build
npm link

# In your n8n installation directory
cd /path/to/n8n
npm link n8n-nodes-upstage --legacy-peer-deps

# Start n8n with community nodes enabled
N8N_COMMUNITY_NODES_ENABLED=true n8n start
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [Upstage Console](https://console.upstage.ai/)
- [Upstage Documentation](https://developers.upstage.ai/)
- [Solar LLM Documentation](https://developers.upstage.ai/docs/apis/chat)
- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [GitHub Repository](https://github.com/UpstageAI/n8n-nodes-upstage)
- [Report Issues](https://github.com/UpstageAI/n8n-nodes-upstage/issues)

## Acknowledgments

- Built with [n8n](https://n8n.io/) workflow automation platform
- Powered by [Upstage Solar](https://upstage.ai/) AI models
- Implements n8n AI Agent interfaces without external dependencies

---

**Made with ❤️ by Upstage**
