export function createOpenApiDocument() {
  return {
    components: {
      schemas: {
        CollectAttempt: {
          properties: {
            accepted: { type: "boolean" },
            eventName: { type: "string" },
            host: { type: "string" },
            kind: { type: "string" },
            path: { type: "string" },
            reason: { type: "string" },
            siteId: { type: "string" },
            timestamp: { format: "date-time", type: "string" },
          },
          required: [
            "accepted",
            "eventName",
            "host",
            "kind",
            "path",
            "reason",
            "siteId",
            "timestamp",
          ],
          type: "object",
        },
        SiteInput: {
          properties: {
            allowedEventProperties: {
              items: { type: "string" },
              type: "array",
            },
            domains: {
              items: { type: "string" },
              type: "array",
            },
            id: { type: "string" },
            name: { type: "string" },
          },
          required: ["id", "name"],
          type: "object",
        },
      },
      securitySchemes: {
        adminToken: {
          description: "Set this to MIKROANALYTICS_ADMIN_TOKEN.",
          scheme: "bearer",
          type: "http",
        },
        sessionCookie: {
          description: "HttpOnly MikroAuth session cookie for dashboard users.",
          in: "cookie",
          name: "mikroanalytics_access_token",
          type: "apiKey",
        },
      },
    },
    info: {
      description: "Private, aggregate-first analytics ingestion and reporting API.",
      title: "MikroAnalytics API",
      version: "0.1.0",
    },
    openapi: "3.1.0",
    paths: {
      "/config.json": {
        get: {
          responses: {
            200: { description: "Browser runtime config and public auth routes" },
          },
          summary: "Get browser runtime config",
        },
      },
      "/api/cleanup": {
        post: {
          responses: {
            200: { description: "Cleanup result" },
            401: { description: "Unauthorized" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Delete expired aggregate and raw debug records",
        },
      },
      "/api/auth/magic-link": {
        post: {
          responses: {
            202: { description: "Request accepted without revealing whether the email is allowed" },
            400: { description: "Invalid request" },
          },
          summary: "Request a MikroAuth magic link",
        },
      },
      "/api/auth/me": {
        get: {
          responses: {
            200: { description: "Current dashboard session" },
            401: { description: "Unauthenticated" },
          },
          summary: "Get current dashboard auth state",
        },
      },
      "/api/auth/logout": {
        post: {
          responses: {
            204: { description: "Session cookie cleared" },
          },
          summary: "Sign out dashboard session",
        },
      },
      "/api/auth/verify": {
        post: {
          responses: {
            200: { description: "Session cookie set" },
            400: { description: "Invalid request" },
          },
          summary: "Verify a MikroAuth magic link token",
        },
      },
      "/api/collect": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    campaign: { type: "object" },
                    event: { type: "string" },
                    host: { type: "string" },
                    kind: { enum: ["pageview", "event"], type: "string" },
                    path: { type: "string" },
                    properties: { type: "object" },
                    referrer: { type: "string" },
                    site: { type: "string" },
                  },
                  required: ["site"],
                  type: "object",
                },
              },
            },
          },
          responses: {
            202: { description: "Accepted or privacy-ignored" },
            400: { description: "Invalid payload" },
          },
          summary: "Collect a pageview or custom event",
        },
      },
      "/api/report": {
        get: {
          parameters: [
            { in: "query", name: "site", required: true, schema: { type: "string" } },
            {
              in: "query",
              name: "days",
              required: false,
              schema: { default: 30, type: "integer" },
            },
            {
              description: "Inclusive report start date. Use with end.",
              in: "query",
              name: "start",
              required: false,
              schema: { format: "date", type: "string" },
            },
            {
              description: "Inclusive report end date. Use with start.",
              in: "query",
              name: "end",
              required: false,
              schema: { format: "date", type: "string" },
            },
          ],
          responses: {
            200: { description: "Aggregate analytics report" },
            401: { description: "Unauthorized" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Get aggregate analytics report",
        },
      },
      "/api/collect-attempts": {
        get: {
          parameters: [{ in: "query", name: "site", required: false, schema: { type: "string" } }],
          responses: {
            200: { description: "Recent in-memory collect attempts" },
            401: { description: "Unauthorized" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Get recent collect attempts for install checks",
        },
      },
      "/api/sites": {
        get: {
          responses: {
            200: { description: "Dashboard-managed sites" },
            401: { description: "Unauthorized" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "List sites and script snippets",
        },
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SiteInput" },
              },
            },
            required: true,
          },
          responses: {
            201: { description: "Site created" },
            400: { description: "Invalid site" },
            401: { description: "Unauthorized" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Create a site",
        },
      },
      "/api/sites/{id}": {
        delete: {
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Site and stored analytics data deleted" },
            401: { description: "Unauthorized" },
            404: { description: "Site not found" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Delete a site and its analytics data",
        },
        put: {
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SiteInput" },
              },
            },
            required: true,
          },
          responses: {
            200: { description: "Site updated" },
            400: { description: "Invalid site" },
            401: { description: "Unauthorized" },
            404: { description: "Site not found" },
          },
          security: [{ sessionCookie: [] }, { adminToken: [] }],
          summary: "Update a site",
        },
      },
      "/health": {
        get: {
          responses: {
            200: { description: "Service health" },
          },
          summary: "Check service health",
        },
      },
    },
  };
}
