'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

// Import Swagger UI styles
import 'swagger-ui-react/swagger-ui.css';

export default function APIDocs() {
  // Configuration for Swagger UI
  const swaggerConfig = {
    url: '/api/docs', // API route that serves the OpenAPI spec
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      // SwaggerUIBundle.presets.apis,
      // SwaggerUIStandalonePreset
    ],
    plugins: [
      // SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: 'StandaloneLayout',
    validatorUrl: null,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    onComplete: () => {
      console.log('Swagger UI loaded successfully');
    },
    requestInterceptor: (request: any) => {
      // Add authentication token if available
      const token = localStorage.getItem('authToken');
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
      }
      return request;
    },
    responseInterceptor: (response: any) => {
      // Handle response logging or transformation
      console.log('API Response:', response);
      return response;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Learning Assistant API Documentation
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                  Comprehensive API reference and interactive testing interface
                </p>
              </div>
              <div className="flex space-x-4">
                <a
                  href="/docs/developer-guide"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Developer Guide
                </a>
                <a
                  href="/docs/architecture"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Architecture
                </a>
                <a
                  href="https://github.com/your-repo/learning-assistant"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">
            Quick Start Guide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-2">1. Authentication</h3>
              <p className="text-sm text-gray-600">
                Get your API token by logging in through the authentication endpoints.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-2">2. Test Endpoints</h3>
              <p className="text-sm text-gray-600">
                Use the interactive interface below to test API endpoints with real data.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-2">3. Integrate</h3>
              <p className="text-sm text-gray-600">
                Copy the generated code samples to integrate with your application.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            API Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Adaptive Learning</h3>
                <p className="text-sm text-gray-500">VARK-based personalization</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Security First</h3>
                <p className="text-sm text-gray-500">JWT, RBAC, rate limiting</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Real-time Analytics</h3>
                <p className="text-sm text-gray-500">Performance tracking</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">AI-Powered</h3>
                <p className="text-sm text-gray-500">Smart recommendations</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="swagger-ui-wrapper">
            <SwaggerUI {...swaggerConfig} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              © 2024 Learning Assistant. Built with Next.js and OpenAPI.
            </div>
            <div className="flex space-x-6">
              <a href="/docs/changelog" className="text-sm text-gray-500 hover:text-gray-900">
                Changelog
              </a>
              <a href="/docs/support" className="text-sm text-gray-500 hover:text-gray-900">
                Support
              </a>
              <a href="/docs/examples" className="text-sm text-gray-500 hover:text-gray-900">
                Examples
              </a>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .swagger-ui-wrapper {
          font-family: inherit;
        }
        
        .swagger-ui .info {
          margin: 20px 0;
        }
        
        .swagger-ui .info .title {
          font-size: 24px;
          color: #1f2937;
        }
        
        .swagger-ui .info .description {
          color: #6b7280;
          line-height: 1.6;
        }
        
        .swagger-ui .scheme-container {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
        }
        
        .swagger-ui .opblock {
          border-radius: 6px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        
        .swagger-ui .opblock .opblock-summary {
          border-radius: 6px 6px 0 0;
        }
        
        .swagger-ui .btn {
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .swagger-ui .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .swagger-ui .topbar {
          background: #1f2937;
          border-bottom: 1px solid #374151;
        }
        
        .swagger-ui .topbar .download-url-wrapper {
          display: none;
        }
        
        .swagger-ui .info .title small {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin-left: 10px;
        }
        
        .swagger-ui .response-control-media-type__accept-message {
          color: #059669;
          font-weight: 500;
        }
        
        .swagger-ui .parameter__name {
          font-weight: 600;
          color: #1f2937;
        }
        
        .swagger-ui .parameter__type {
          color: #6b7280;
          font-style: italic;
        }
        
        .swagger-ui .model {
          font-family: 'Monaco', 'Consolas', monospace;
        }
        
        .swagger-ui .model-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }
        
        .swagger-ui .responses-inner h4 {
          color: #1f2937;
          font-weight: 600;
        }
        
        .swagger-ui .response .response-col_status {
          font-weight: 600;
        }
        
        .swagger-ui .opblock-tag {
          color: #1f2937;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 14px;
        }
        
        .swagger-ui .opblock.opblock-get {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
        }
        
        .swagger-ui .opblock.opblock-get .opblock-summary {
          border-color: #10b981;
        }
        
        .swagger-ui .opblock.opblock-post {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }
        
        .swagger-ui .opblock.opblock-post .opblock-summary {
          border-color: #3b82f6;
        }
        
        .swagger-ui .opblock.opblock-put {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.05);
        }
        
        .swagger-ui .opblock.opblock-put .opblock-summary {
          border-color: #f59e0b;
        }
        
        .swagger-ui .opblock.opblock-delete {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }
        
        .swagger-ui .opblock.opblock-delete .opblock-summary {
          border-color: #ef4444;
        }
        
        .swagger-ui .authorization__btn {
          background: #3b82f6;
          border-color: #3b82f6;
        }
        
        .swagger-ui .authorization__btn:hover {
          background: #2563eb;
          border-color: #2563eb;
        }
        
        /* Custom scrollbar for better UX */
        .swagger-ui ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .swagger-ui ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}