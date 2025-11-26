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

// Daily limit configuration (to stay within free tier)
const DAILY_LIMIT = {
  enabled: true, // Set to false to disable daily limit
  maxRequests: 95000, // Set below 100k to have buffer (95k safe limit)
  warnThreshold: 0.9, // Warn at 90% usage (85,500 requests)
};

// In-memory cache for reasons data (persists across requests in same Worker instance)
// This dramatically reduces KV read operations (from ~100k/day to ~1-2/day)
let reasonsCache = {
  data: null,
  timestamp: 0,
  ttl: 3600000, // 1 hour in milliseconds
};

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

    // Daily limit check (to stay within free tier)
    const dailyLimitResponse = await checkDailyLimit(env);
    if (dailyLimitResponse) {
      return dailyLimitResponse;
    }

    // Rate limiting check (per-IP)
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Increment daily counter (fire and forget)
    ctx.waitUntil(incrementDailyCounter(env));

    try {
      // Route handlers
      if (path === '/health') {
        return await handleHealth(env);
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

// Daily limit check (to stay within Cloudflare free tier)
async function checkDailyLimit(env) {
  if (!DAILY_LIMIT.enabled) {
    return null;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `daily:${today}`;

  const data = await env.RATE_LIMIT_KV.get(key, { type: 'json' });

  if (!data) {
    // First request today
    return null;
  }

  const { count } = data;
  const percentUsed = count / DAILY_LIMIT.maxRequests;

  // Check if limit exceeded
  if (count >= DAILY_LIMIT.maxRequests) {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const resetIn = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);

    return jsonResponse(
      {
        error: 'Daily request limit reached',
        message: `Service has reached its daily limit of ${DAILY_LIMIT.maxRequests} requests. This helps keep the service free!`,
        limit: DAILY_LIMIT.maxRequests,
        current: count,
        resetAt: tomorrow.toISOString(),
        resetIn: `${Math.floor(resetIn / 3600)}h ${Math.floor((resetIn % 3600) / 60)}m`,
      },
      {
        status: 429,
        headers: {
          'X-Daily-Limit': DAILY_LIMIT.maxRequests.toString(),
          'X-Daily-Remaining': '0',
          'X-Daily-Reset': resetIn.toString(),
          'Retry-After': resetIn.toString(),
        },
      }
    );
  }

  return null;
}

// Increment daily request counter
async function incrementDailyCounter(env) {
  if (!DAILY_LIMIT.enabled) {
    return;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `daily:${today}`;

  const data = await env.RATE_LIMIT_KV.get(key, { type: 'json' });

  if (!data) {
    // First request today
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify({ count: 1, date: today }),
      { expirationTtl: 86400 * 2 } // Keep for 2 days
    );
  } else {
    // Increment counter
    data.count++;
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify(data),
      { expirationTtl: 86400 * 2 }
    );
  }
}

// Rate limiting using Workers KV
async function checkRateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${ip}`;

  // Get current rate limit data
  const data = await env.RATE_LIMIT_KV.get(key, { type: 'json' });
  const now = Date.now();

  if (!data) {
    // First request from this IP
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify({ count: 1, resetAt: now + RATE_LIMIT.windowMs }),
      { expirationTtl: 60 }
    );
    return null;
  }

  // Check if window has expired
  if (now > data.resetAt) {
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify({ count: 1, resetAt: now + RATE_LIMIT.windowMs }),
      { expirationTtl: 60 }
    );
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
  await env.RATE_LIMIT_KV.put(
    key,
    JSON.stringify(data),
    { expirationTtl: 60 }
  );

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

// Get daily usage stats for headers
async function getDailyUsageHeaders(env) {
  if (!DAILY_LIMIT.enabled) {
    return {};
  }

  const today = new Date().toISOString().split('T')[0];
  const key = `daily:${today}`;
  const data = await env.RATE_LIMIT_KV.get(key, { type: 'json' });

  const count = data ? data.count : 0;
  const remaining = Math.max(0, DAILY_LIMIT.maxRequests - count);

  return {
    'X-Daily-Limit': DAILY_LIMIT.maxRequests.toString(),
    'X-Daily-Remaining': remaining.toString(),
    'X-Daily-Used': count.toString(),
  };
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
async function handleHealth(env) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'noaas-cloudflare-workers',
    edge_location: 'global',
  };

  // Add daily usage stats if enabled
  if (DAILY_LIMIT.enabled) {
    const today = new Date().toISOString().split('T')[0];
    const key = `daily:${today}`;
    const data = await env.RATE_LIMIT_KV.get(key, { type: 'json' });

    const count = data ? data.count : 0;
    const remaining = DAILY_LIMIT.maxRequests - count;
    const percentUsed = (count / DAILY_LIMIT.maxRequests) * 100;

    health.daily_usage = {
      requests_today: count,
      limit: DAILY_LIMIT.maxRequests,
      remaining: remaining,
      percent_used: Math.round(percentUsed * 100) / 100,
      resets_at: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
    };

    // Add warning if approaching limit
    if (percentUsed >= DAILY_LIMIT.warnThreshold * 100) {
      health.status = 'warning';
      health.warning = `Approaching daily limit (${Math.round(percentUsed)}% used)`;
    }
  }

  return jsonResponse(health);
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
