import { NextRequest, NextResponse } from "next/server";
import { getTimelineForHandles, Tweet } from "@/lib/twitter";

export async function GET(request: NextRequest) {
  // Check if Twitter API is configured
  if (!process.env.TWITTER_BEARER_TOKEN) {
    return NextResponse.json(
      {
        tweets: [],
        error: "Twitter API not configured",
      },
      { status: 200 }
    );
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const handlesParam = searchParams.get("handles");
    const maxParam = searchParams.get("max");

    // Validate handles parameter
    if (!handlesParam) {
      return NextResponse.json(
        {
          tweets: [],
          error: "Missing required parameter: handles",
        },
        { status: 400 }
      );
    }

    // Parse handles (comma-separated)
    const handles = handlesParam
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (handles.length === 0) {
      return NextResponse.json(
        {
          tweets: [],
          error: "No valid handles provided",
        },
        { status: 400 }
      );
    }

    // Parse max results (default 30, max 100)
    let maxResults = 30;
    if (maxParam) {
      const parsed = parseInt(maxParam, 10);
      if (!isNaN(parsed)) {
        maxResults = Math.min(Math.max(parsed, 1), 100);
      }
    }

    // Get timeline tweets
    const tweets: Tweet[] = await getTimelineForHandles(handles, maxResults);

    // Return response with cached flag
    return NextResponse.json(
      {
        tweets,
        cached: false, // Could be enhanced to track cache hits
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in timeline API route:", error);
    return NextResponse.json(
      {
        tweets: [],
        error: "Failed to fetch timeline",
      },
      { status: 500 }
    );
  }
}
