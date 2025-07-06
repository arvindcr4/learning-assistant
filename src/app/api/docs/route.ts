// API Documentation endpoint with OpenAPI specification
import { NextRequest, NextResponse } from 'next/server';

// OpenAPI 3.0 specification for Personal Learning Assistant API
const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Personal Learning Assistant API',
    version: '1.0.0',
    description: 'Comprehensive API for adaptive learning system with personalized content, progress tracking, and analytics',
    contact: {
      name: 'API Support',
      email: 'api-support@learningassistant.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Development server'
    }
  ],
  security: [
    {
      bearerAuth: []
    },
    {
      apiKey: []
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'educator', 'admin'] }
        }
      },
      LearningProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          dominantStyle: { type: 'string', enum: ['visual', 'auditory', 'reading', 'kinesthetic'] },
          isMultimodal: { type: 'boolean' },
          adaptationLevel: { type: 'number', minimum: 0, maximum: 100 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Assessment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['formative', 'summative', 'diagnostic'] },
          timeLimit: { type: 'number' },
          passingScore: { type: 'number', minimum: 0, maximum: 100 },
          questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } }
        }
      },
      Question: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          text: { type: 'string' },
          type: { type: 'string', enum: ['multiple-choice', 'true-false', 'short-answer'] },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswer: { type: 'string' },
          points: { type: 'number' }
        }
      },
      LearningSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          contentId: { type: 'string' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          duration: { type: 'number' },
          completed: { type: 'boolean' }
        }
      },
      Progress: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          contentId: { type: 'string' },
          progress: { type: 'number', minimum: 0, maximum: 100 },
          completed: { type: 'boolean' },
          lastAccessed: { type: 'string', format: 'date-time' }
        }
      },
      Goal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          targetValue: { type: 'number' },
          currentValue: { type: 'number' },
          status: { type: 'string', enum: ['active', 'completed', 'paused', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        }
      },
      Analytics: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          timeRange: { 
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          },
          overallProgress: { type: 'object' },
          generatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Recommendation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['content', 'pace', 'style', 'schedule', 'goal'] },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      APIResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' },
          error: { type: 'string' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  },
  paths: {
    '/learning/profile': {
      get: {
        summary: 'Get learning profile',
        description: 'Retrieve user learning profile with style preferences and adaptation data',
        tags: ['Profile'],
        parameters: [
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
            description: 'User ID (optional, defaults to authenticated user)'
          }
        ],
        responses: {
          '200': {
            description: 'Learning profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/LearningProfile' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      post: {
        summary: 'Create learning profile',
        description: 'Initialize a new learning profile with VARK assessment data',
        tags: ['Profile'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  varkResponses: { type: 'object' }
                },
                required: ['varkResponses']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Learning profile created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/LearningProfile' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/learning/assessment': {
      get: {
        summary: 'Get assessments',
        description: 'Retrieve assessments with filtering options',
        tags: ['Assessment'],
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }
        ],
        responses: {
          '200': {
            description: 'Assessments retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Assessment' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/learning/session': {
      get: {
        summary: 'Get learning sessions',
        description: 'Retrieve learning sessions with filtering and pagination',
        tags: ['Session'],
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Learning sessions retrieved successfully'
          }
        }
      },
      post: {
        summary: 'Create learning session',
        description: 'Start a new learning session',
        tags: ['Session'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  sessionData: { $ref: '#/components/schemas/LearningSession' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Learning session created successfully' }
        }
      }
    },
    '/learning/progress': {
      get: {
        summary: 'Get progress data',
        description: 'Retrieve detailed progress tracking data',
        tags: ['Progress'],
        responses: {
          '200': { description: 'Progress data retrieved successfully' }
        }
      }
    },
    '/learning/analytics': {
      get: {
        summary: 'Get analytics data',
        description: 'Retrieve comprehensive learning analytics',
        tags: ['Analytics'],
        responses: {
          '200': { description: 'Analytics data retrieved successfully' }
        }
      }
    },
    '/learning/recommendations': {
      get: {
        summary: 'Get recommendations',
        description: 'Retrieve personalized learning recommendations',
        tags: ['Recommendations'],
        responses: {
          '200': { description: 'Recommendations retrieved successfully' }
        }
      }
    }
  },
  responses: {
    BadRequest: {
      description: 'Bad request - validation error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    Unauthorized: {
      description: 'Unauthorized - authentication required',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    Forbidden: {
      description: 'Forbidden - insufficient permissions',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    InternalServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    }
  },
  tags: [
    { name: 'Profile', description: 'User learning profile management' },
    { name: 'Assessment', description: 'Assessment and quiz management' },
    { name: 'Session', description: 'Learning session tracking' },
    { name: 'Progress', description: 'Progress tracking and goals' },
    { name: 'Analytics', description: 'Learning analytics and insights' },
    { name: 'Recommendations', description: 'Personalized recommendations' },
    { name: 'Content', description: 'Adaptive content management' }
  ]
};

// GET /api/docs - Return OpenAPI specification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  
  if (format === 'yaml') {
    // Convert to YAML format (simplified)
    return new NextResponse(JSON.stringify(openAPISpec, null, 2), {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  return NextResponse.json(openAPISpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// GET /api/docs/swagger - Return Swagger UI HTML
export async function POST(request: NextRequest) {
  const swaggerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Personal Learning Assistant API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
        .swagger-ui .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/docs',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            requestInterceptor: (request) => {
                // Add authentication headers if available
                const token = localStorage.getItem('auth-token');
                if (token) {
                    request.headers['Authorization'] = \`Bearer \${token}\`;
                }
                return request;
            },
            onComplete: () => {
                console.log('Swagger UI loaded');
            }
        });
    </script>
</body>
</html>`;

  return new NextResponse(swaggerHTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}