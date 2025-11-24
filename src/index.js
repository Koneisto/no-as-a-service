// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');

// Environment variable validation
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY || '1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const REASONS_FILE_PATH = process.env.REASONS_FILE_PATH || './reasons.json';

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535.`);
  process.exit(1);
}

const app = express();

// Trust proxy configuration (specify number of proxies or specific IPs)
app.set('trust proxy', TRUST_PROXY);

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// JSON support with error handling
app.use(express.json());

// Input validation middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error: Invalid JSON" }
    });
  }
  next(err);
});

// Load reasons with error handling
let reasons = [];
try {
  const data = fs.readFileSync(REASONS_FILE_PATH, 'utf-8');
  reasons = JSON.parse(data);
  if (!Array.isArray(reasons) || reasons.length === 0) {
    throw new Error(`${REASONS_FILE_PATH} must be a non-empty array`);
  }
  console.log(`Loaded ${reasons.length} rejection reasons from ${REASONS_FILE_PATH}`);
} catch (error) {
  console.error(`Failed to load ${REASONS_FILE_PATH}: ${error.message}`);
  console.error('Server will start but return errors for rejection requests.');
  // Server continues but with empty reasons array
}

// Rate limiter configuration
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
  message: {
    error: process.env.RATE_LIMIT_MESSAGE ||
           `Too many requests, please try again later. (${RATE_LIMIT_MAX} reqs/${RATE_LIMIT_WINDOW_MS/1000}s per IP)`
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable `X-RateLimit-*` headers
});

app.use(limiter);

// === HEALTH CHECK ===

app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    reasons_loaded: reasons.length
  };

  if (reasons.length === 0) {
    status.status = 'degraded';
    status.warning = 'No rejection reasons loaded';
    return res.status(503).json(status);
  }

  res.json(status);
});

// === MCP ENDPOINTS ===

app.get('/v1/context', (req, res) => {
  if (reasons.length === 0) {
    return res.status(503).json({
      error: "Service unavailable: No rejection reasons loaded"
    });
  }
  const reason = reasons[Math.floor(Math.random() * reasons.length)];
  res.json({
    context: {
      rejection_reason: reason,
      source: "noaas",
      type: "rejection-humor"
    },
    metadata: {
      version: "1.0.0",
      description: "An MCP-compliant Context Server delivering curated rejection responses.",
      license: "MIT",
      provider: "systems@koneisto",
      update: new Date().toISOString()
    }
  });
});

app.get('/v1/server', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      name: "NoaasServer",
      version: "1.0.0",
      capabilities: ["tools", "resources", "prompts"]
    }
  });
});

app.post('/v1/tools/list', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      tools: [
        {
          name: "getRandomNo",
          description: "Returns a random rejection",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["polite", "humorous", "professional", "creative"]
              }
            },
            required: []
          }
        },
        {
          name: "getNoCount",
          description: "Returns total count of available rejections",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      ]
    }
  });
});

app.post('/v1/tools/call', (req, res) => {
  const { method, params = {} } = req.body;

  if (!method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params: method is required" }
    });
  }

  if (method === "getRandomNo") {
    if (reasons.length === 0) {
      return res.status(503).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Service unavailable: No rejection reasons loaded" }
      });
    }

    let filtered = reasons;
    const category = params.category;

    if (category) {
      const startIndex = {
        polite: 0,
        humorous: Math.floor(reasons.length * 0.25),
        professional: Math.floor(reasons.length * 0.5),
        creative: Math.floor(reasons.length * 0.75)
      }[category] || 0;

      const count = Math.floor(reasons.length * 0.25);
      filtered = reasons.slice(startIndex, startIndex + count);
    }

    const selected = filtered[Math.floor(Math.random() * filtered.length)];
    return res.json({ jsonrpc: "2.0", result: { response: selected } });

  } else if (method === "getNoCount") {
    return res.json({ jsonrpc: "2.0", result: { count: reasons.length } });

  } else {
    return res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not found" }
    });
  }
});

app.post('/v1/resources/list', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      resources: [
        { name: "no_responses", description: "Collection of creative no responses" },
        { name: "about", description: "Info about this NoaaS API" }
      ]
    }
  });
});

app.post('/v1/resources/get', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params: resource name is required" }
    });
  }

  if (name === "no_responses") {
    return res.json({
      jsonrpc: "2.0",
      result: {
        content: {
          sample_no_responses: reasons.slice(0, 10),
          total_count: reasons.length,
          description: "Professionally crafted rejections for different situations."
        }
      }
    });
  } else if (name === "about") {
    return res.json({
      jsonrpc: "2.0",
      result: {
        content: {
          name: "No-as-a-Service",
          version: "1.0.0",
          license: "MIT",
          description: "Delivers strategic 'no' responses.",
          mcp_compliance: "Implements Model Context Protocol"
        }
      }
    });
  }

  return res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32601, message: "Resource not found" }
  });
});

app.post('/v1/prompts/list', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      prompts: [
        {
          name: "rejection_response",
          description: "Prompt for generating rejection text",
          template: "Generate a {{tone}} rejection response for '{{request}}'"
        },
        {
          name: "explain_no",
          description: "Prompt to explain why saying no is beneficial",
          template: "Explain why saying no to '{{request}}' helps {{person}}"
        }
      ]
    }
  });
});

app.post('/v1/prompts/get', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params: prompt name is required" }
    });
  }

  const templates = {
    rejection_response: {
      template: "Generate a {{tone}} rejection response for '{{request}}'",
      variables: {
        tone: { type: "string", enum: ["polite", "firm", "humorous", "professional"] },
        request: { type: "string" }
      }
    },
    explain_no: {
      template: "Explain why saying no to '{{request}}' helps {{person}}",
      variables: {
        request: { type: "string" },
        person: { type: "string" }
      }
    }
  };

  if (templates[name]) {
    return res.json({ jsonrpc: "2.0", result: templates[name] });
  }

  return res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32601, message: "Prompt not found" }
  });
});

app.post('/v1/initialize', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      session_id: `noaas-${Date.now()}`,
      message: "Initialized NoaaS server successfully"
    }
  });
});

app.post('/v1/shutdown', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    result: {
      message: "Server resources released successfully"
    }
  });
});

// JSON-RPC error formatter
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const errorResponse = {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Server error"
    }
  };

  // Only include error details in development
  if (NODE_ENV === 'development') {
    errorResponse.error.data = {
      details: err.message,
      stack: err.stack
    };
  }

  res.status(500).json(errorResponse);
});

// Graceful shutdown
let server;

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forcefully shutting down after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Model Context Server (MCP) running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Loaded ${reasons.length} rejection reasons`);
  });
}

module.exports = app;