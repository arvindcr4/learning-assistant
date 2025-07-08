import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Handle build-time scenarios where auth might not be fully initialized
let handlers: { GET: any; POST: any };

try {
  handlers = toNextJsHandler(auth);
} catch (error) {
  console.warn('Failed to create auth handlers during build time:', error instanceof Error ? error.message : error);
  
  // Create fallback handlers for build time
  const fallbackHandler = async (req: NextRequest) => {
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  };
  
  handlers = {
    GET: fallbackHandler,
    POST: fallbackHandler,
  };
}

export const { GET, POST } = handlers;