import { NextRequest, NextResponse } from "next/server";
import { lookupUsers, TwitterUser } from "@/lib/twitter";

export async function GET(request: NextRequest) {
  try {
    // Check if Twitter API is configured
    if (!process.env.TWITTER_BEARER_TOKEN) {
      return NextResponse.json(
        {
          users: [],
          error: "Twitter API not configured",
        },
        { status: 200 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const handlesParam = searchParams.get("handles");

    // Validate handles parameter
    if (!handlesParam) {
      return NextResponse.json(
        {
          users: [],
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
          users: [],
          error: "No valid handles provided",
        },
        { status: 400 }
      );
    }

    // Look up users
    const users: TwitterUser[] = await lookupUsers(handles);

    // Return response
    return NextResponse.json(
      {
        users,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in users API route:", error);
    return NextResponse.json(
      {
        users: [],
        error: "Failed to fetch users",
      },
      { status: 500 }
    );
  }
}
