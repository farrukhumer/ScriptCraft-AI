import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { subreddit = "HOA", sort = "top", t = "week" } = req.query;
    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?t=${t}&limit=10`;
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "ScriptCraftAI/1.0.0"
      }
    });

    const posts = response.data.data.children.map((child: any) => ({
      id: child.data.id,
      title: child.data.title,
      text: child.data.selftext,
      url: `https://reddit.com${child.data.permalink}`,
      upvotes: child.data.ups,
      num_comments: child.data.num_comments,
      author: child.data.author
    }));

    res.status(200).json(posts);
  } catch (error: any) {
    console.error("Reddit fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch from Reddit" });
  }
}
