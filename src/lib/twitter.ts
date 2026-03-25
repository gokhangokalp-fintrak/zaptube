const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export interface Tweet {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  urls?: { display_url: string; expanded_url: string }[];
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profileImageUrl: string;
  description: string;
  followersCount: number;
  tweetCount: number;
}

function makeRequest<T>(
  url: string,
  params?: Record<string, string | number>
): Promise<T> {
  if (!BEARER_TOKEN) {
    return Promise.resolve(null as any);
  }

  const urlObj = new URL(url);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.append(key, String(value));
    });
  }

  return fetch(urlObj.toString(), {
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "User-Agent": "ZapTube/1.0",
    },
  })
    .then((res) => res.json())
    .catch((error) => {
      console.error("Twitter API request failed:", error);
      return null;
    });
}

function formatTweet(
  tweet: any,
  users: Map<string, any>,
  includes?: any
): Tweet | null {
  const author = users.get(tweet.author_id);
  if (!author) return null;

  const urls = tweet.entities?.urls?.map((url: any) => ({
    display_url: url.display_url,
    expanded_url: url.expanded_url,
  }));

  return {
    id: tweet.id,
    text: tweet.text,
    authorName: author.name,
    authorHandle: author.username,
    authorAvatar: author.profile_image_url || "",
    createdAt: tweet.created_at,
    likeCount: tweet.public_metrics?.like_count || 0,
    retweetCount: tweet.public_metrics?.retweet_count || 0,
    replyCount: tweet.public_metrics?.reply_count || 0,
    quoteCount: tweet.public_metrics?.quote_count || 0,
    urls,
  };
}

export async function lookupUsers(
  handles: string[]
): Promise<TwitterUser[]> {
  if (!BEARER_TOKEN || handles.length === 0) {
    return [];
  }

  const cacheKey = `users:${handles.sort().join(",")}`;
  const cached = getCachedData<TwitterUser[]>(cacheKey);
  if (cached) return cached;

  const results: TwitterUser[] = [];

  // Batch by 100 handles per request
  for (let i = 0; i < handles.length; i += 100) {
    const batch = handles.slice(i, i + 100);
    const handleString = batch.join(",");

    try {
      const response = await makeRequest<any>(
        "https://api.twitter.com/2/users/by",
        {
          usernames: handleString,
          "user.fields":
            "profile_image_url,description,public_metrics",
        }
      );

      if (response?.data) {
        response.data.forEach((user: any) => {
          results.push({
            id: user.id,
            name: user.name,
            username: user.username,
            profileImageUrl: user.profile_image_url || "",
            description: user.description || "",
            followersCount: user.public_metrics?.followers_count || 0,
            tweetCount: user.public_metrics?.tweet_count || 0,
          });
        });
      }
    } catch (error) {
      console.error("Error looking up users:", error);
    }
  }

  setCachedData(cacheKey, results);
  return results;
}

export async function getUserTweets(
  userId: string,
  maxResults = 10
): Promise<Tweet[]> {
  if (!BEARER_TOKEN || !userId) {
    return [];
  }

  const cacheKey = `tweets:${userId}:${maxResults}`;
  const cached = getCachedData<Tweet[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await makeRequest<any>(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      {
        max_results: Math.min(maxResults, 100),
        "tweet.fields": "created_at,public_metrics,entities",
        expansions: "author_id",
        "user.fields": "profile_image_url,name,username",
      }
    );

    if (!response?.data) {
      return [];
    }

    const userMap = new Map<string, any>();
    if (response.includes?.users) {
      response.includes.users.forEach((user: any) => {
        userMap.set(user.id, user);
      });
    }

    const tweets = response.data
      .map((tweet: any) => formatTweet(tweet, userMap, response.includes))
      .filter((tweet: Tweet | null): tweet is Tweet => tweet !== null);

    setCachedData(cacheKey, tweets);
    return tweets;
  } catch (error) {
    console.error("Error getting user tweets:", error);
    return [];
  }
}

export async function getTimelineForHandles(
  handles: string[],
  maxResults = 30
): Promise<Tweet[]> {
  if (!BEARER_TOKEN || handles.length === 0) {
    return [];
  }

  const cacheKey = `timeline:${handles.sort().join(",")}:${maxResults}`;
  const cached = getCachedData<Tweet[]>(cacheKey);
  if (cached) return cached;

  const results: Tweet[] = [];
  const userMap = new Map<string, any>();

  // Build query from handles, batching if needed (max 512 chars)
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentQueryLength = 0;

  for (const handle of handles) {
    const queryPart = `from:${handle} OR `;
    if (currentQueryLength + queryPart.length > 512 && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentQueryLength = 0;
    }
    currentBatch.push(handle);
    currentQueryLength += queryPart.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  for (const batch of batches) {
    const query = batch.map((h) => `from:${h}`).join(" OR ");

    try {
      const response = await makeRequest<any>(
        "https://api.twitter.com/2/tweets/search/recent",
        {
          query,
          max_results: Math.min(maxResults, 100),
          "tweet.fields": "created_at,public_metrics,entities",
          expansions: "author_id",
          "user.fields": "profile_image_url,name,username",
        }
      );

      if (response?.data) {
        if (response.includes?.users) {
          response.includes.users.forEach((user: any) => {
            userMap.set(user.id, user);
          });
        }

        response.data.forEach((tweet: any) => {
          const formattedTweet = formatTweet(tweet, userMap, response.includes);
          if (formattedTweet) {
            results.push(formattedTweet);
          }
        });
      }
    } catch (error) {
      console.error("Error getting timeline:", error);
    }
  }

  // Sort by created_at DESC
  results.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Limit to maxResults
  const limitedResults = results.slice(0, maxResults);
  setCachedData(cacheKey, limitedResults);
  return limitedResults;
}
