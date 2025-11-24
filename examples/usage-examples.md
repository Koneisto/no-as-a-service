# NoaaS API Usage Examples

This document provides practical examples of using the NoaaS API in different scenarios.

## Table of Contents
- [Basic Usage](#basic-usage)
- [JavaScript/TypeScript](#javascripttypescript)
- [Python](#python)
- [cURL](#curl)
- [Integration Examples](#integration-examples)

---

## Basic Usage

### Check if Service is Running
```bash
curl https://noaas.yourdomain.com/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T20:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "reasons_loaded": 921
}
```

---

## JavaScript/TypeScript

### Get Random Rejection

```javascript
async function getRandomRejection(category = null) {
  const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'getRandomNo',
      params: category ? { category } : {}
    })
  });

  const data = await response.json();
  return data.result.response;
}

// Usage
const rejection = await getRandomRejection('humorous');
console.log(rejection);
// Output: "I'd love to say yes, but my calendar is allergic to that date."
```

### Get All Categories

```javascript
async function getRejectionsInAllCategories() {
  const categories = ['polite', 'humorous', 'professional', 'creative'];
  const results = {};

  for (const category of categories) {
    const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'getRandomNo',
        params: { category }
      })
    });

    const data = await response.json();
    results[category] = data.result.response;
  }

  return results;
}

// Usage
const allRejections = await getRejectionsInAllCategories();
console.log(allRejections);
```

### Get Total Count

```javascript
async function getTotalRejectionCount() {
  const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'getNoCount'
    })
  });

  const data = await response.json();
  return data.result.count;
}

// Usage
const count = await getTotalRejectionCount();
console.log(`Total rejections available: ${count}`);
// Output: Total rejections available: 921
```

### TypeScript Interface

```typescript
interface NoaasResponse {
  jsonrpc: string;
  result: {
    response?: string;
    count?: number;
  };
}

interface NoaasRequest {
  method: 'getRandomNo' | 'getNoCount';
  params?: {
    category?: 'polite' | 'humorous' | 'professional' | 'creative';
  };
}

async function callNoaas(request: NoaasRequest): Promise<NoaasResponse> {
  const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  return response.json();
}
```

---

## Python

### Basic Example

```python
import requests

def get_random_rejection(category=None):
    url = 'https://noaas.yourdomain.com/v1/tools/call'

    payload = {
        'method': 'getRandomNo',
        'params': {}
    }

    if category:
        payload['params']['category'] = category

    response = requests.post(url, json=payload)
    data = response.json()

    return data['result']['response']

# Usage
rejection = get_random_rejection('professional')
print(rejection)
# Output: "I appreciate the offer, but I need to focus on my current priorities."
```

### With Error Handling

```python
import requests
from typing import Optional, Dict

class NoaasClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json'
        })

    def _call_api(self, method: str, params: Optional[Dict] = None) -> Dict:
        """Make API call with error handling"""
        url = f'{self.base_url}/v1/tools/call'

        payload = {
            'method': method,
            'params': params or {}
        }

        try:
            response = self.session.post(url, json=payload, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f'API call failed: {e}')

    def get_random_no(self, category: Optional[str] = None) -> str:
        """Get a random rejection"""
        params = {'category': category} if category else {}
        result = self._call_api('getRandomNo', params)
        return result['result']['response']

    def get_count(self) -> int:
        """Get total count of rejections"""
        result = self._call_api('getNoCount')
        return result['result']['count']

    def health_check(self) -> Dict:
        """Check service health"""
        url = f'{self.base_url}/health'
        response = self.session.get(url, timeout=5)
        return response.json()

# Usage
client = NoaasClient('https://noaas.yourdomain.com')

# Get random rejection
print(client.get_random_no('humorous'))

# Get count
print(f"Total: {client.get_count()}")

# Check health
health = client.health_check()
print(f"Status: {health['status']}")
```

### Async Python Example

```python
import asyncio
import aiohttp

async def get_random_rejection_async(category=None):
    url = 'https://noaas.yourdomain.com/v1/tools/call'

    payload = {
        'method': 'getRandomNo',
        'params': {'category': category} if category else {}
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            data = await response.json()
            return data['result']['response']

# Usage
async def main():
    tasks = [
        get_random_rejection_async('polite'),
        get_random_rejection_async('humorous'),
        get_random_rejection_async('professional'),
    ]

    results = await asyncio.gather(*tasks)
    for i, rejection in enumerate(results):
        print(f"{i+1}. {rejection}")

asyncio.run(main())
```

---

## cURL

### Get Random Rejection (Any Category)

```bash
curl -X POST https://noaas.yourdomain.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{}}'
```

### Get Professional Rejection

```bash
curl -X POST https://noaas.yourdomain.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"professional"}}'
```

### Get Count

```bash
curl -X POST https://noaas.yourdomain.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getNoCount"}'
```

### Check Health

```bash
curl https://noaas.yourdomain.com/health
```

### Get Context (Quick Random)

```bash
curl https://noaas.yourdomain.com/v1/context
```

### List Available Tools

```bash
curl -X POST https://noaas.yourdomain.com/v1/tools/list \
  -H "Content-Type: application/json"
```

### Get Resources

```bash
curl -X POST https://noaas.yourdomain.com/v1/resources/get \
  -H "Content-Type: application/json" \
  -d '{"name":"no_responses"}'
```

---

## Integration Examples

### Slack Bot Integration

```javascript
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Respond to "no" command
app.command('/no', async ({ command, ack, respond }) => {
  await ack();

  // Get random rejection from NoaaS
  const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'getRandomNo',
      params: { category: command.text || 'humorous' }
    })
  });

  const data = await response.json();
  const rejection = data.result.response;

  await respond({
    text: rejection,
    response_type: 'in_channel'
  });
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack bot is running!');
})();
```

### Discord Bot

```javascript
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.on('messageCreate', async message => {
  if (message.content.startsWith('!no')) {
    const category = message.content.split(' ')[1] || null;

    const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'getRandomNo',
        params: category ? { category } : {}
      })
    });

    const data = await response.json();
    message.reply(data.result.response);
  }
});

client.login(process.env.DISCORD_TOKEN);
```

### Chrome Extension

```javascript
// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getNo') {
    fetch('https://noaas.yourdomain.com/v1/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'getRandomNo',
        params: { category: request.category }
      })
    })
    .then(res => res.json())
    .then(data => sendResponse({ rejection: data.result.response }))
    .catch(err => sendResponse({ error: err.message }));

    return true; // Keep channel open for async response
  }
});

// popup.js
document.getElementById('getNo').addEventListener('click', async () => {
  chrome.runtime.sendMessage(
    { action: 'getNo', category: 'humorous' },
    response => {
      document.getElementById('result').textContent = response.rejection;
    }
  );
});
```

### React Hook

```typescript
import { useState, useEffect } from 'react';

interface UseNoaasOptions {
  category?: 'polite' | 'humorous' | 'professional' | 'creative';
  autoFetch?: boolean;
}

export function useNoaas(options: UseNoaasOptions = {}) {
  const [rejection, setRejection] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRejection = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://noaas.yourdomain.com/v1/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'getRandomNo',
          params: options.category ? { category: options.category } : {}
        })
      });

      const data = await response.json();
      setRejection(data.result.response);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch) {
      fetchRejection();
    }
  }, [options.autoFetch, options.category]);

  return { rejection, loading, error, refetch: fetchRejection };
}

// Usage in component
function RejectionButton() {
  const { rejection, loading, refetch } = useNoaas({ category: 'humorous' });

  return (
    <div>
      <button onClick={refetch} disabled={loading}>
        {loading ? 'Getting rejection...' : 'Get Random No'}
      </button>
      {rejection && <p>{rejection}</p>}
    </div>
  );
}
```

---

## Rate Limiting

The API has a rate limit of **120 requests per minute per IP**. Check the headers:

```bash
curl -i https://noaas.yourdomain.com/v1/context

# Look for:
# RateLimit-Limit: 120
# RateLimit-Remaining: 119
# RateLimit-Reset: 59
```

### Handling Rate Limits

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const resetHeader = response.headers.get('RateLimit-Reset');
      const waitTime = resetHeader ? parseInt(resetHeader) * 1000 : 60000;

      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## Testing

```bash
# Run basic health check
curl https://noaas.yourdomain.com/health

# Test all categories
for category in polite humorous professional creative; do
  echo "=== $category ==="
  curl -s -X POST https://noaas.yourdomain.com/v1/tools/call \
    -H "Content-Type: application/json" \
    -d "{\"method\":\"getRandomNo\",\"params\":{\"category\":\"$category\"}}" | jq -r '.result.response'
  echo ""
done

# Load test (requires 'hey' tool)
hey -n 1000 -c 10 https://noaas.yourdomain.com/health
```

---

## Support

For more examples and API documentation, see:
- [README.md](../README.md)
- [API Documentation](../README.md#api-endpoints)
- [Deployment Guide](../CLOUDFLARE_DEPLOY.md)
