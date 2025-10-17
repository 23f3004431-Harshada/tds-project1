# LLM App Generator API

An API server that accepts task requests, uses an LLM to generate web applications, deploys them to GitHub Pages, and handles iterative updates.

## Features

- 🤖 **LLM Integration**: Supports OpenAI GPT-4 and Anthropic Claude
- 📦 **GitHub Integration**: Automatic repo creation and GitHub Pages deployment
- 🔄 **Iterative Updates**: Handles Round 2+ updates to existing apps
- 📡 **Async Processing**: Non-blocking task processing with callback notifications
- 💾 **State Management**: Tracks task states for multi-round updates

## Prerequisites

1. **Node.js** (v18 or higher)
2. **GitHub Personal Access Token** with these scopes:
   - `repo` (full control)
   - `workflow`
   - `admin:repo_hook`
3. **LLM API Key** (OpenAI or Anthropic)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_USERNAME=your_username
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_key_here
PORT=3000
```

### 3. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with these permissions:
   - ✅ `repo` (all)
   - ✅ `workflow`
   - ✅ `admin:repo_hook`
3. Copy the token to your `.env` file

### 4. Get LLM API Key

**For OpenAI:**
- Visit https://platform.openai.com/api-keys
- Create a new API key

**For Anthropic:**
- Visit https://console.anthropic.com/settings/keys
- Create a new API key

## Usage

### Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### API Endpoints

#### 1. POST `/task` - Submit a Task

**Round 1 (New App):**
```json
{
  "taskId": "unique-task-id",
  "description": "Create a todo list app with add, complete, and delete functionality",
  "evaluationUrl": "https://your-evaluation-api.com/callback",
  "round": 1
}
```

**Round 2 (Update App):**
```json
{
  "taskId": "same-task-id-as-round-1",
  "description": "Add dark mode and local storage to persist tasks",
  "evaluationUrl": "https://your-evaluation-api.com/callback",
  "round": 2,
  "repoName": "app-task-123456"
}
```

**Response:**
```json
{
  "message": "Task accepted and processing",
  "taskId": "unique-task-id",
  "round": 1
}
```

**Callback to Evaluation API (Success):**
```json
{
  "taskId": "unique-task-id",
  "round": 1,
  "status": "completed",
  "repoUrl": "https://github.com/username/app-task-123456",
  "deploymentUrl": "https://username.github.io/app-task-123456",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Callback to Evaluation API (Failure):**
```json
{
  "taskId": "unique-task-id",
  "round": 1,
  "status": "failed",
  "error": "Error message here",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

#### 2. GET `/task/:taskId` - Check Task Status

```bash
curl http://localhost:3000/task/unique-task-id
```

**Response:**
```json
{
  "taskId": "unique-task-id",
  "repoName": "app-task-123456",
  "repoUrl": "https://github.com/username/app-task-123456",
  "pagesUrl": "https://username.github.io/app-task-123456",
  "round": 1
}
```

#### 3. GET `/health` - Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "llmProvider": "openai",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

## Testing

Run the test client:

```bash
npm test
```

This will:
1. Check server health
2. Submit a Round 1 task (create new app)
3. Check task status after 5 seconds

To test Round 2, uncomment the Round 2 test in `test-client.js` and provide the repo name from Round 1.

## Workflow

### Round 1 (Initial App Creation)
1. Instructor sends task request with `round: 1`
2. Server generates app code using LLM
3. Server creates GitHub repo
4. Server enables GitHub Pages
5. Server pushes code to repo
6. Server sends results to evaluation API

### Round 2 (App Update)
1. Instructor sends update request with `round: 2` and same `taskId`
2. Server retrieves previous app code
3. Server generates updated code using LLM with context
4. Server updates existing GitHub repo
5. GitHub Pages auto-deploys changes
6. Server sends updated results to evaluation API

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Instructor  │────────▶│   API Server │────────▶│     LLM     │
│             │         │              │         │ (GPT/Claude)│
└─────────────┘         └──────────────┘         └─────────────┘
      ▲                        │
      │                        ▼
      │                 ┌──────────────┐
      │                 │    GitHub    │
      │                 │     API      │
      │                 └──────────────┘
      │                        │
      │                        ▼
      │                 ┌──────────────┐
      └─────────────────│  Evaluation  │
                        │     API      │
                        └──────────────┘
```

## Production Considerations

For production deployment, consider:

1. **Database**: Replace `Map()` with Redis or PostgreSQL for persistent state
2. **Queue System**: Use Bull or RabbitMQ for task queue management
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Error Handling**: Implement retry logic for API failures
5. **Logging**: Add structured logging (Winston, Pino)
6. **Monitoring**: Integrate APM tools (DataDog, New Relic)
7. **Security**: Add authentication/authorization for API access
8. **Scalability**: Deploy behind load balancer with multiple instances

## Troubleshooting

### GitHub Pages Not Working
- Wait 2-3 minutes after repo creation
- Check repo settings → Pages section
- Ensure `index.html` exists in root

### LLM Timeouts
- Increase timeout in axios config
- Use streaming for large responses
- Consider shorter prompts

### Rate Limits
- GitHub: 5,000 requests/hour
- OpenAI: Depends on your plan
- Anthropic: Depends on your plan

## License

MIT