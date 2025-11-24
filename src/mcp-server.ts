#!/usr/bin/env node
/**
 * NoaaS MCP Server
 *
 * Model Context Protocol server for No-as-a-Service
 * Provides creative rejection responses through MCP-compatible interface
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || "https://api.mcp-for-no.com";

// Initialize the MCP server
const server = new Server(
  {
    name: "noaas",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Tool schemas
const getRandomNoSchema = z.object({
  category: z.enum(["polite", "humorous", "professional", "creative"]).optional()
    .describe("Category of rejection (polite, humorous, professional, creative)")
});

// Define available tools
const tools: Tool[] = [
  {
    name: "getRandomNo",
    description: "Get a creative way to decline a request. Returns a random rejection message from the specified category or any category if not specified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["polite", "humorous", "professional", "creative"],
          description: "Category of rejection: polite (gentle), humorous (funny), professional (corporate-speak), creative (imaginative)"
        }
      }
    }
  },
  {
    name: "getNoCount",
    description: "Get the total count of available rejection messages (currently 1,021 different ways to say no)",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  }
];

// Handle tools/list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tools/call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "getRandomNo") {
      const validated = getRandomNoSchema.parse(args || {});
      return await callNoaasApi("getRandomNo", validated.category ? { category: validated.category } : undefined);
    }

    if (name === "getNoCount") {
      return await callNoaasApi("getNoCount");
    }

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}. Available tools: getRandomNo, getNoCount`
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`
        }
      ]
    };
  }
});

/**
 * Call the NoaaS REST API
 */
async function callNoaasApi(method: string, params?: Record<string, any>) {
  const url = `${API_BASE_URL}/v1/tools/call`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: params || {},
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`API error: ${data.error.message || "Unknown error"}`);
    }

    // Format the response based on the method
    if (method === "getRandomNo") {
      return {
        content: [
          {
            type: "text",
            text: data.result.response
          }
        ]
      };
    }

    if (method === "getNoCount") {
      return {
        content: [
          {
            type: "text",
            text: `There are ${data.result.count} different ways to say no available in the NoaaS database.`
          }
        ]
      };
    }

    // Fallback for other responses
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data.result, null, 2)
        }
      ]
    };
  } catch (error) {
    throw new Error(
      `Failed to call NoaaS API: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Main entry point - connect to stdio transport
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr (stdout is used for MCP communication)
    console.error("NoaaS MCP server started successfully");
    console.error(`API endpoint: ${API_BASE_URL}`);
    console.error("Available tools: getRandomNo, getNoCount");
  } catch (error) {
    console.error("Failed to start NoaaS MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main();
