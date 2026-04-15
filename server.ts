import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Reddit fetching
  app.get("/api/reddit", async (req, res) => {
    try {
      const { subreddit = "HOA", sort = "top", t = "week" } = req.query;
      // Reddit JSON API
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

      res.json(posts);
    } catch (error: any) {
      console.error("Reddit fetch error:", error.message);
      res.status(500).json({ error: "Failed to fetch from Reddit" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
