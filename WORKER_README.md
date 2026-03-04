{
  "name": "reflective-ai",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "worker:dev": "wrangler dev"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "lucide-react": "^0.294.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}# ReflectivAI Backend - Cloudflare Worker

This is the backend API server for the ReflectivAI application, built with Cloudflare Workers.

## Features

✅ **Authentication** - Session-based auth with login/logout  
✅ **LLM Integration** - OpenAI GPT-4 integration for AI coaching and analysis  
✅ **Knowledge Base** - Curated sales coaching snippets and frameworks  
✅ **User Logging** - Track user activity and sessions  
✅ **App Settings** - Public app configuration and feature toggles  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

You need an OpenAI API key to enable LLM features. Get one at <https://platform.openai.com/api-keys>

#### For Local Development

```bash
# Set environment variable (macOS/Linux)
export OPENAI_API_KEY=sk_your_api_key_here

# Or on Windows:
set OPENAI_API_KEY=sk_your_api_key_here

# Then start the worker
npx wrangler dev
```

#### For Production Deployment

```bash
# Use wrangler to securely store the secret
wrangler secret put OPENAI_API_KEY

# When prompted, paste your OpenAI API key
```

### 3. Run Locally

```bash
npx wrangler dev
```

The worker will start on `http://localhost:8787`

In the main app, it proxies to this worker automatically via Vite's dev server proxy.

## API Endpoints

### Authentication

#### **POST /api/auth/login**

Create a new session (login)

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"coach@example.com"}'
```

Response:

```json
{
  "success": true,
  "user": {
    "id": "user1",
    "name": "Demo User",
    "email": "demo@example.com",
    "role": "sales_rep",
    "createdAt": "2026-02-27T..."
  },
  "session": {
    "token": "session_..."
  }
}
```

#### **GET /api/auth/me**

Get current authenticated user

```bash
curl http://localhost:8787/api/auth/me \
  -H "Cookie: session=session_..."
```

#### **POST /api/auth/logout**

Logout and invalidate session

```bash
curl -X POST http://localhost:8787/api/auth/logout \
  -H "Cookie: session=session_..."
```

---

### App Configuration

#### **GET /api/apps/public/prod/public-settings/by-id/:appId**

Get app features and settings

```bash
curl http://localhost:8787/api/apps/public/prod/public-settings/by-id/app1
```

Response:

```json
{
  "appId": "app1",
  "name": "ReflectivAI",
  "features": {
    "roleplay_simulator": true,
    "scenario_builder": true,
    "coaching_insights": true,
    "behavior_analytics": true,
    "ai_feedback": true,
    "knowledge_base": true
  },
  "capabilities": [
    "signal_awareness",
    "signal_interpretation",
    "value_connection",
    "objection_navigation",
    "commitment_generation"
  ]
}
```

---

### LLM / AI Coaching

#### **POST /api/llm/invoke**

Call the LLM for coaching analysis, scenario generation, feedback, etc.

```bash
curl -X POST http://localhost:8787/api/llm/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this sales call transcript and provide feedback...",
    "max_tokens": 2000,
    "temperature": 0.7,
    "response_json_schema": {
      "type": "object",
      "properties": {
        "feedback": { "type": "string" },
        "score": { "type": "number" }
      }
    }
  }'
```

**Note:** If `response_json_schema` is provided, the response will be parsed as JSON.

Response (with schema):

```json
{
  "response": {
    "feedback": "Excellent use of diagnostic questions...",
    "score": 4.5
  },
  "model": "gpt-4-turbo",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 250
  }
}
```

Response (without OpenAI API key configured):

```json
{
  "response": "Mock AI response - Please configure OPENAI_API_KEY environment variable...",
  "model": "gpt-4",
  "isDevelopment": true
}
```

---

### User Logging

#### **POST /api/logs/user**

Log user activity or events

```bash
curl -X POST http://localhost:8787/api/logs/user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=session_..." \
  -d '{
    "event": "session_started",
    "scenario_id": "scenario_123",
    "page": "/roleplay-simulator",
    "metadata": {
      "duration_seconds": 120,
      "message_count": 5
    }
  }'
```

Response:

```json
{
  "success": true,
  "logId": "log_1708929...",
  "timestamp": "2026-02-27T..."
}
```

---

### Knowledge Base

#### **GET /api/snippets**

Get knowledge base snippets with optional filtering

```bash
# Get all snippets
curl http://localhost:8787/api/snippets

# Filter by category
curl http://localhost:8787/api/snippets?category=objection_handling

# Search by keyword
curl http://localhost:8787/api/snippets?search=listening
```

Response:

```json
{
  "snippets": [
    {
      "id": "1",
      "title": "Objection Handling 101",
      "content": "Learn the foundational techniques...",
      "category": "objection_handling",
      "curated": true,
      "tags": ["objection", "communication", "defensive"],
      "createdAt": "2025-06-15"
    }
  ],
  "total": 4,
  "categories": [
    "objection_handling",
    "value_connection",
    "signal_interpretation",
    "commitment_generation"
  ]
}
```

---

### Health Check

#### **GET /health**

Check if the worker is running

```bash
curl http://localhost:8787/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-27T...",
  "version": "1.0.0",
  "endpoints": [...]
}
```

---

## Features in Detail

### Session Management

- Sessions are stored in-memory during development
- In production, upgrade to Durable Objects or KV storage
- Sessions expire after 24 hours
- Cookies are HttpOnly, Secure, and SameSite=Lax

### LLM Integration

- Uses OpenAI's GPT-4-Turbo model by default
- Supports custom JSON response formatting via `response_json_schema`
- Fallback to mock responses if API key not configured
- Temperature and token limits are configurable

### Knowledge Base

- Pre-populated with 4 curated coaching snippets
- Searchable by title, content, and tags
- Filterable by category
- Easy to extend with more snippets

### Error Handling

- All endpoints return JSON with proper HTTP status codes
- 401 for unauthorized (missing session)
- 400 for bad requests (missing required fields)
- 500 for server errors
- 404 for not found endpoints

---

## Development

### Project Structure

```
src/
├── worker.js          # Main Cloudflare Worker code
├── ...
vite.config.js       # Includes proxy to /api → localhost:8787
wrangler.toml        # Cloudflare Worker configuration
.env.example         # Template for environment variables
```

### Vite Proxy Configuration

The Vite dev server automatically proxies API requests to the worker:

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true
    }
  }
}
```

This means the frontend can make requests to `http://localhost:5173/api/...` and they'll be forwarded to the worker.

---

## Deployment to Production

### Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI installed

### Steps

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Deploy
wrangler deploy

# 3. Set production secrets (for OPENAI_API_KEY, etc.)
wrangler secret put OPENAI_API_KEY --env production

# 4. Your worker is live at:
# https://reflect-ai-now-worker.your-subdomain.workers.dev
```

### Next Steps for Production

- **Database**: Migrate from in-memory storage to Durable Objects or external database
- **Sessions**: Use Durable Objects for distributed session management
- **Logging**: Integrate with a logging service (Datadog, LogRocket, etc.)
- **Caching**: Add caching headers and leverage Cloudflare's cache
- **Rate Limiting**: Add rate limiting to prevent abuse

---

## Troubleshooting

### "404 Not Found" on `/api/auth/me`

- Make sure the session cookie is being sent
- Check browser dev tools → Cookies to see if `session` cookie exists
- Try logging in first via `/api/auth/login`

### "OpenAI API error" or "Unable to reach LLM service"

- Verify your `OPENAI_API_KEY` environment variable is set correctly
- Check OpenAI API status at <https://status.openai.com>
- Verify you have credits in your OpenAI account

### Worker not starting

- Run `wrangler dev --verbose` to see detailed logs
- Check `wrangler.toml` syntax
- Ensure `src/worker.js` has valid JavaScript syntax

---

## Support

For issues or questions:

1. Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
2. Review the inline comments in `src/worker.js`
3. Enable DEBUG mode in `.env` for more verbose logging
