/**
 * Cloudflare Workers MCP Server - No-as-a-Service
 *
 * This is a Cloudflare Workers implementation that:
 * - Uses the MCP (Model Context Protocol) standard
 * - Stores reasons in Workers KV
 * - Has built-in rate limiting
 * - Costs $0/month on free tier (100k requests/day)
 */

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Security headers
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Rate limiting configuration
const RATE_LIMIT = {
  requests: 30,
  windowMs: 60000, // 1 minute
};

// In-memory cache for reasons data (persists across requests in same Worker instance)
// This dramatically reduces KV read operations (from ~100k/day to ~1-2/day)
let reasonsCache = {
  data: null,
  timestamp: 0,
  ttl: 3600000, // 1 hour in milliseconds
};

// In-memory rate limiting per IP (no KV puts!)
// Note: This is per-isolate, so rate limits are approximate across edge locations,
// but eliminates KV put operations entirely
const rateLimitCache = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Rate limiting check (per-IP, in-memory)
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    try {
      // Route handlers
      if (path === '/health') {
        return handleHealth();
      }

      if (path === '/v1/server' && request.method === 'GET') {
        return handleServerInfo();
      }

      if (path === '/v1/context' && request.method === 'GET') {
        return await handleContext(env);
      }

      if (path === '/v1/tools/list' && request.method === 'POST') {
        return handleToolsList();
      }

      if (path === '/v1/tools/call' && request.method === 'POST') {
        return await handleToolsCall(request, env);
      }

      if (path === '/v1/resources/list' && request.method === 'POST') {
        return handleResourcesList();
      }

      if (path === '/v1/resources/get' && request.method === 'POST') {
        return await handleResourcesGet(request, env);
      }

      if (path === '/v1/prompts/list' && request.method === 'POST') {
        return handlePromptsList();
      }

      if (path === '/v1/prompts/get' && request.method === 'POST') {
        return handlePromptsGet(request);
      }

      if (path === '/v1/initialize' && request.method === 'POST') {
        return handleInitialize();
      }

      if (path === '/v1/shutdown' && request.method === 'POST') {
        return handleShutdown();
      }

      // 404 for unknown routes
      return jsonResponse(
        { error: 'Not found' },
        { status: 404 }
      );
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse(
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Server error',
          },
        },
        { status: 500 }
      );
    }
  },
};

// In-memory rate limiting (no KV operations)
function checkRateLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();

  // Clean up expired entries periodically (every ~100 requests)
  if (Math.random() < 0.01) {
    for (const [key, data] of rateLimitCache) {
      if (now > data.resetAt) {
        rateLimitCache.delete(key);
      }
    }
  }

  const data = rateLimitCache.get(ip);

  if (!data || now > data.resetAt) {
    // First request or window expired
    rateLimitCache.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return null;
  }

  // Check if limit exceeded
  if (data.count >= RATE_LIMIT.requests) {
    const resetIn = Math.ceil((data.resetAt - now) / 1000);
    return jsonResponse(
      {
        error: 'Too many requests, please try again later. (30 reqs/min/IP)',
      },
      {
        status: 429,
        headers: {
          'RateLimit-Limit': RATE_LIMIT.requests.toString(),
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': resetIn.toString(),
          'Retry-After': resetIn.toString(),
        },
      }
    );
  }

  // Increment counter
  data.count++;
  return null;
}

// Get reasons from KV with in-memory caching
// This reduces KV reads from ~100k/day to just 1-2 per Worker instance
async function getReasons(env) {
  const now = Date.now();

  // Check if cache is valid
  if (reasonsCache.data && (now - reasonsCache.timestamp) < reasonsCache.ttl) {
    return reasonsCache.data;
  }

  // Cache miss or expired - fetch from KV
  const cached = await env.REASONS_KV.get('reasons', { type: 'text' });
  if (!cached) {
    throw new Error('Reasons not found in KV storage');
  }

  const reasons = JSON.parse(cached);

  // Update cache
  reasonsCache.data = reasons;
  reasonsCache.timestamp = now;

  return reasons;
}


// Helper to create JSON responses
function jsonResponse(data, options = {}) {
  const { status = 200, headers = {} } = options;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

// Health check handler
function handleHealth() {
  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'noaas-cloudflare-workers',
    edge_location: 'global',
  });
}

// Server info handler
function handleServerInfo() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      name: 'NoaasServer',
      version: '1.0.0',
      capabilities: ['tools', 'resources', 'prompts'],
    },
  });
}

// Context handler
async function handleContext(env) {
  const reasons = await getReasons(env);
  if (!reasons || reasons.length === 0) {
    return jsonResponse(
      { error: 'Service unavailable: No rejection reasons loaded' },
      { status: 503 }
    );
  }

  const reason = reasons[Math.floor(Math.random() * reasons.length)];
  return jsonResponse({
    context: {
      rejection_reason: reason,
      source: 'noaas',
      type: 'rejection-humor',
    },
    metadata: {
      version: '1.0.0',
      description: 'An MCP-compliant Context Server delivering curated rejection responses.',
      license: 'MIT',
      provider: 'systems@koneisto',
      update: new Date().toISOString(),
    },
  });
}

// Tools list handler
function handleToolsList() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      tools: [
        {
          name: 'getRandomNo',
          description: 'Returns a random rejection',
          parameters: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['polite', 'humorous', 'professional', 'creative'],
              },
            },
            required: [],
          },
        },
        {
          name: 'getNoCount',
          description: 'Returns total count of available rejections',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    },
  });
}

// Tools call handler
async function handleToolsCall(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
      },
      { status: 400 }
    );
  }

  const { method, params = {} } = body;

  if (!method) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Invalid params: method is required' },
      },
      { status: 400 }
    );
  }

  const reasons = await getReasons(env);

  if (method === 'getRandomNo') {
    if (!reasons || reasons.length === 0) {
      return jsonResponse(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Service unavailable: No rejection reasons loaded' },
        },
        { status: 503 }
      );
    }

    let filtered = reasons;
    const category = params.category;

    if (category) {
      const startIndex = {
        polite: 0,
        humorous: Math.floor(reasons.length * 0.25),
        professional: Math.floor(reasons.length * 0.5),
        creative: Math.floor(reasons.length * 0.75),
      }[category] || 0;

      const count = Math.floor(reasons.length * 0.25);
      filtered = reasons.slice(startIndex, startIndex + count);
    }

    const selected = filtered[Math.floor(Math.random() * filtered.length)];
    return jsonResponse({ jsonrpc: '2.0', result: { response: selected } });
  } else if (method === 'getNoCount') {
    return jsonResponse({ jsonrpc: '2.0', result: { count: reasons.length } });
  } else {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
      },
      { status: 404 }
    );
  }
}

// Resources list handler
function handleResourcesList() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      resources: [
        { name: 'no_responses', description: 'Collection of creative no responses' },
        { name: 'about', description: 'Info about this NoaaS API' },
      ],
    },
  });
}

// Resources get handler
async function handleResourcesGet(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
      },
      { status: 400 }
    );
  }

  const { name } = body;
  if (!name) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Invalid params: resource name is required' },
      },
      { status: 400 }
    );
  }

  const reasons = await getReasons(env);

  if (name === 'no_responses') {
    return jsonResponse({
      jsonrpc: '2.0',
      result: {
        content: {
          sample_no_responses: reasons.slice(0, 10),
          total_count: reasons.length,
          description: 'Professionally crafted rejections for different situations.',
        },
      },
    });
  } else if (name === 'about') {
    return jsonResponse({
      jsonrpc: '2.0',
      result: {
        content: {
          name: 'No-as-a-Service',
          version: '1.0.0',
          license: 'MIT',
          description: 'Delivers strategic "no" responses.',
          mcp_compliance: 'Implements Model Context Protocol',
        },
      },
    });
  }

  return jsonResponse(
    {
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Resource not found' },
    },
    { status: 404 }
  );
}

// Prompts list handler
function handlePromptsList() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      prompts: [
        {
          name: 'rejection_response',
          description: 'Prompt for generating rejection text',
          template: "Generate a {{tone}} rejection response for '{{request}}'",
        },
        {
          name: 'explain_no',
          description: 'Prompt to explain why saying no is beneficial',
          template: "Explain why saying no to '{{request}}' helps {{person}}",
        },
      ],
    },
  });
}

// Prompts get handler
async function handlePromptsGet(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
      },
      { status: 400 }
    );
  }

  const { name } = body;

  if (!name) {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Invalid params: prompt name is required' },
      },
      { status: 400 }
    );
  }

  const templates = {
    rejection_response: {
      template: "Generate a {{tone}} rejection response for '{{request}}'",
      variables: {
        tone: { type: 'string', enum: ['polite', 'firm', 'humorous', 'professional'] },
        request: { type: 'string' },
      },
    },
    explain_no: {
      template: "Explain why saying no to '{{request}}' helps {{person}}",
      variables: {
        request: { type: 'string' },
        person: { type: 'string' },
      },
    },
  };

  if (templates[name]) {
    return jsonResponse({ jsonrpc: '2.0', result: templates[name] });
  }

  return jsonResponse(
    {
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Prompt not found' },
    },
    { status: 404 }
  );
}

// Initialize handler
function handleInitialize() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      session_id: `noaas-${Date.now()}`,
      message: 'Initialized NoaaS server successfully',
    },
  });
}

// Shutdown handler
function handleShutdown() {
  return jsonResponse({
    jsonrpc: '2.0',
    result: {
      message: 'Server resources released successfully',
    },
  });
}
