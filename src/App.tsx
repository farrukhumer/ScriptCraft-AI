import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Sparkles, 
  Copy, 
  Download, 
  Languages, 
  Edit3, 
  ChevronRight, 
  History, 
  Trash2, 
  Check,
  Plus,
  ArrowRight,
  BookOpen,
  Zap,
  Loader2,
  MousePointer2,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Upload,
  Clock
} from "lucide-react";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import * as React from "react"
import { auth, loginWithGoogle, logout, syncUserProfile, UserProfile, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { LogOut, Settings as SettingsIcon } from "lucide-react";

const STORY_MODEL = "gemini-1.5-flash";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RedditPost, GeneratedStory, StoryChapter, PromptGeneration, ImagePrompt, ThumbnailPrompt } from "@/src/types";

export default function App() {
  const [inputText, setInputText] = useState("");
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [urduStory, setUrduStory] = useState<GeneratedStory | null>(null);
  const [showUrdu, setShowUrdu] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("input");
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem("GEMINI_API_KEY") || 
    (import.meta.env.VITE_GEMINI_API_KEY as string) || 
    ""
  );
  const [apiProvider, setApiProvider] = useState<"gemini" | "openrouter">(() => 
    (localStorage.getItem("API_PROVIDER") as any) || "gemini"
  );
  
  const [isValidated, setIsValidated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [showApiInput, setShowApiInput] = useState(false);

  // Initialize AI instances
  // We prioritize the user's saved key from their profile if it exists
  const activeApiKey = profile?.customGeminiKey || apiKey || "";
  
  const ai = React.useMemo(() => new GoogleGenAI({ apiKey: activeApiKey }), [activeApiKey]);
  const openRouter = React.useMemo(() => new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: profile?.customOpenRouterKey || activeApiKey,
    dangerouslyAllowBrowser: true
  }), [activeApiKey, profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsAuthLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const userProfile = await syncUserProfile(currentUser);
        setProfile(userProfile);
        setIsValidated(true);
        // If we have a user, we can bypass the splash after a delay
        setTimeout(() => setShowSplash(false), 2000);
      } else {
        setUser(null);
        setProfile(null);
        setIsValidated(false);
        setShowSplash(true);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsVerifying(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
      setVerificationError("Google Login failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const askAI = async (prompt: string, options: { 
    isJson?: boolean, 
    schema?: any 
  } = {}) => {
    // Check for API Key - either from user profile, local storage, or a global env variable
    const key = activeApiKey;
    
    if (!key) {
      throw new Error("No API Key found. Please add an API Key in settings.");
    }

    if (apiProvider === "gemini") {
      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: options.isJson ? {
          responseMimeType: "application/json",
          responseSchema: options.schema
        } : undefined
      });
      const text = response.text || "";
      return options.isJson ? JSON.parse(text) : text;
    } else {
      const systemPrompt = options.isJson 
        ? "You are a helpful assistant that ALWAYS outputs valid JSON."
        : "You are a helpful assistant.";
      
      const response = await openRouter.chat.completions.create({
        model: "qwen/qwen-2.5-72b-instruct", 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: options.isJson ? { type: "json_object" } : undefined
      });
      const text = response.choices[0].message.content || "";
      return options.isJson ? JSON.parse(text) : text;
    }
  };
  const [promptInput, setPromptInput] = useState("");
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [promptHistory, setPromptHistory] = useState<PromptGeneration[]>([]);
  const [currentPromptGeneration, setCurrentPromptGeneration] = useState<PromptGeneration | null>(null);

  // Thumbnail Generator State
  const [thumbnailInput, setThumbnailInput] = useState("");
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailHistory, setThumbnailHistory] = useState<ThumbnailPrompt[]>([]);
  const [currentThumbnailPrompt, setCurrentThumbnailPrompt] = useState<ThumbnailPrompt | null>(null);

  // Fetch Reddit Posts
  const fetchReddit = async (subreddit: string = "HOA") => {
    setIsFetching(true);
    try {
      const response = await axios.get(`/api/reddit?subreddit=${subreddit}`);
      setRedditPosts(response.data);
    } catch (error) {
      console.error("Error fetching Reddit posts:", error);
    } finally {
      setIsFetching(false);
    }
  };

  // Step 1: Generate Titles
  const generateTitles = async (text: string) => {
    if (!text) return;
    setIsGeneratingTitles(true);
    setTitles([]);
    setSelectedTitle(null);
    setStory(null);
    setUrduStory(null);
    
    try {
      const prompt = `
        You are a viral content strategist. Based on the following content, generate 10 high-quality, long, and descriptive titles that are perfect for a story script.
        One title must have a shocking twist mentioned in it.
        
        Content: "${text}"
        
        Output must be in JSON format with a key "titles" which is an array of strings.
      `;

      const jsonResult = await askAI(prompt, {
        isJson: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            titles: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["titles"]
        }
      });

      setTitles(jsonResult.titles);
      setActiveTab("titles");
    } catch (error) {
      console.error("Title generation error:", error);
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  // Step 2: Generate Full Story based on Selected Title
  const generateFullStory = async (title: string) => {
    setIsGeneratingStory(true);
    setSelectedTitle(title);
    
    try {
      const prompt = `
        You are a premium story script writer. Write a high-quality story script based on this specific title and the original context.
        
        Selected Title: "${title}"
        Original Context: "${inputText}"
        
        Requirements:
        1. A strong overall hook (first 10 seconds) that keeps the listener captivated and forced to listen till the end.
        2. A short summary in English.
        3. 8 to 10 Chapters with a detailed, natural narrative flow:
           - Chapter 1: The setup with a powerful hook.
           - Chapters 2-9: Progressive development. Include new events like court hearings (peshi), secret neighbor meetings, or unexpected new attacks from the antagonist to make the script feel long and natural.
           - Final Chapter: The final resolution with a massive, viral-worthy twist.
        
        Output must be in JSON format.
      `;

      const jsonResult = await askAI(prompt, {
        isJson: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            overallHook: { type: Type.STRING },
            summary: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  twist: { type: Type.STRING }
                },
                required: ["id", "title", "content", "twist"]
              }
            }
          },
          required: ["overallHook", "summary", "chapters"]
        }
      });

      const fullStory: GeneratedStory = {
        titles: titles, // Keep original titles
        ...jsonResult
      };
      setStory(fullStory);
      setActiveTab("output");
      
      // Auto-generate Urdu version
      translateToUrdu(fullStory);
    } catch (error) {
      console.error("Story generation error:", error);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const translateToUrdu = async (englishStory: GeneratedStory) => {
    try {
      const prompt = `Translate the following story structure into high-quality, natural Urdu. Keep the structure identical.
      
      Story: ${JSON.stringify(englishStory)}
      
      Output in JSON format with the same keys.`;

      const jsonResult = await askAI(prompt, {
        isJson: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            titles: { type: Type.ARRAY, items: { type: Type.STRING } },
            overallHook: { type: Type.STRING },
            summary: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  twist: { type: Type.STRING }
                },
                required: ["id", "title", "content", "twist"]
              }
            }
          },
          required: ["titles", "overallHook", "summary", "chapters"]
        }
      }) as GeneratedStory;

      setUrduStory(jsonResult);
    } catch (error) {
      console.error("Urdu translation error:", error);
    }
  };

  const handleCopy = () => {
    const currentStory = showUrdu ? urduStory : story;
    if (!currentStory) return;

    const text = `
TITLE: ${selectedTitle}

OVERALL HOOK:
${currentStory.overallHook}

SUMMARY:
${currentStory.summary}

CHAPTERS:
${currentStory.chapters.map(c => `
Chapter ${c.id}: ${c.title}
Content: ${c.content}
Twist: ${c.twist}
`).join("\n")}
    `;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownload = () => {
    const currentStory = showUrdu ? urduStory : story;
    if (!currentStory) return;

    const text = JSON.stringify({ ...currentStory, selectedTitle }, null, 2);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `story-${Date.now()}.txt`;
    a.click();
  };

  const updateChapter = (id: number, field: keyof StoryChapter, value: string) => {
    if (showUrdu) {
      setUrduStory(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chapters: prev.chapters.map(c => c.id === id ? { ...c, [field]: value } : c)
        };
      });
    } else {
      setStory(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chapters: prev.chapters.map(c => c.id === id ? { ...c, [field]: value } : c)
        };
      });
    }
  };

  const generateImagePrompts = async (text: string) => {
    if (!text) return;
    setIsGeneratingPrompts(true);
    
    try {
      const prompt = `
        You are an expert AI image prompt engineer. Based on the story provided, generate a concise description of the main character, a viral thumbnail prompt, and 50 scene-by-scene image prompts.
        
        Story Content: "${text}"
        
        CRITICAL REQUIREMENTS:
        1. "mainCharacterDescription": Create a CONCISE physical description of the main character (e.g., 'Mark, 35yo man in glasses and gray blazer').
        2. "thumbnailPrompt": As a Professional YouTube Thumbnail Concept Artist specializing in HOA and Suburban Drama, read the provided story and generate a single, high-impact Image Generation Prompt.
           - Read & Analyze: Scan the story for the most 'Shocking' and 'Dramatic' point (e.g. HOA Confrontation, Property Destruction, or Illegal Act).
           - Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story. CRITICAL: Expressions must be REALISTIC HUMAN expressions. AVOID any unnatural distortions, pure white eyes, or horror-like facial features. Characters should look like real people in a high-stakes drama, not supernatural entities.
           - Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
           - Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
           - Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
           - Lighting: STRICTLY DAYTIME. Use "Bright, even midday sunlight" or "High-intensity diffused daylight". AVOID deep, harsh shadows or dark silhouettes on the ground or faces. The lighting should be clear and even across the whole scene.
           - Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
           - Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
           - CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        3. "prompts": Generate exactly 50 scene-by-scene prompts.
        4. CHARACTER CONSISTENCY & PRESENCE: For every scene where the main character is present, start the prompt with the concise description created in step 1. 
           CRITICAL RULE: If the character is NOT present in a specific scene, DO NOT include their name or physical description at all. Only describe the environment, the action, the camera angle, and the lighting.
        5. CINEMATIC FOCUS: Focus 60% of each prompt on the cinematic camera angle (e.g., low angle, close-up, wide shot), detailed environment, lighting (e.g., moody, neon, harsh shadows), and the suspenseful/eerie mood of the scene.
        
        Output must be in JSON format.
      `;

      const jsonResult = await askAI(prompt, {
        isJson: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            mainCharacterDescription: { type: Type.STRING },
            thumbnailPrompt: { type: Type.STRING },
            prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["sceneNumber", "description"]
              }
            }
          },
          required: ["mainCharacterDescription", "thumbnailPrompt", "prompts"]
        }
      });

      const newGeneration: PromptGeneration = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        storyTitle: text.slice(0, 50) + "...",
        ...jsonResult
      };

      setCurrentPromptGeneration(newGeneration);
      setPromptHistory(prev => [newGeneration, ...prev]);
    } catch (error) {
      console.error("Prompt generation error:", error);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPromptInput(content);
    };
    reader.readAsText(file);
  };

  const handleThumbnailFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setThumbnailInput(content);
    };
    reader.readAsText(file);
  };

  const handleDownloadPrompts = () => {
    if (!currentPromptGeneration) return;
    
    let text = "";
    if (currentPromptGeneration.thumbnailPrompt) {
      text += `THUMBNAIL PROMPT:\n${currentPromptGeneration.thumbnailPrompt}\n\n---\n\n`;
    }
    text += currentPromptGeneration.prompts.map(p => p.description).join("\n\n");
    
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompts-${Date.now()}.txt`;
    a.click();
  };

  const generateThumbnailPrompt = async (text: string) => {
    if (!text) return;
    setIsGeneratingThumbnail(true);
    
    try {
      const prompt = `
        Role: You are a Professional YouTube Thumbnail Concept Artist specializing in HOA and Suburban Drama.
        
        Task: Read the provided idea or story and generate a single, high-impact Image Generation Prompt. 
        
        Instructions:
        1. Read & Analyze: Scan the text for the most 'Shocking' and 'Dramatic' point (e.g. HOA Confrontation, Property Destruction, or Illegal Act).
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story. CRITICAL: Expressions must be REALISTIC HUMAN expressions. AVOID any unnatural distortions, pure white eyes, or horror-like facial features. Characters should look like real people in a high-stakes drama, not supernatural entities.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Bright, even midday sunlight" or "High-intensity diffused daylight". AVOID deep, harsh shadows or dark silhouettes on the ground or faces. The lighting should be clear and even across the whole scene.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.

        User Idea: "${text}"

        Output Format:
        Return ONLY the final, highly detailed image generation prompt. Do not add conversational text.
      `;

      const output = await askAI(prompt);
      const newPrompt: ThumbnailPrompt = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        input: text,
        output: output.trim()
      };

      setCurrentThumbnailPrompt(newPrompt);
      setThumbnailHistory(prev => [newPrompt, ...prev]);
    } catch (error) {
      console.error("Thumbnail prompt generation error:", error);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const rewriteThumbnailPrompt = async (currentPrompt: string, originalInput: string) => {
    setIsGeneratingThumbnail(true);
    try {
      const prompt = `
        Role: You are a Professional YouTube Thumbnail Concept Artist specializing in HOA and Suburban Drama.
        The user didn't like the previous prompt. Please rewrite it to be even more high-impact and viral.
        
        Instructions:
        1. Read & Analyze: Scan the original idea for the most 'Shocking' and 'Dramatic' point.
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story. CRITICAL: Expressions must be REALISTIC HUMAN expressions. AVOID any unnatural distortions, pure white eyes, or horror-like facial features. Characters should look like real people in a high-stakes drama, not supernatural entities.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Bright, even midday sunlight" or "High-intensity diffused daylight". AVOID deep, harsh shadows or dark silhouettes on the ground or faces. The lighting should be clear and even across the whole scene.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        
        Original Idea: "${originalInput}"
        Previous Prompt: "${currentPrompt}"
        
        Return ONLY the new, improved, highly detailed image generation prompt.
      `;

      const output = await askAI(prompt);
      const newPrompt: ThumbnailPrompt = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        input: originalInput,
        output: output.trim()
      };

      setCurrentThumbnailPrompt(newPrompt);
      setThumbnailHistory(prev => [newPrompt, ...prev]);
    } catch (error) {
      console.error("Thumbnail rewrite error:", error);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const rewriteStoryThumbnail = async () => {
    if (!currentPromptGeneration) return;
    setIsGeneratingPrompts(true); // Re-use this state or similar
    try {
      const prompt = `
        Role: You are a Professional YouTube Thumbnail Concept Artist specializing in HOA and Suburban Drama.
        The user wants a DIFFERENT viral thumbnail prompt for this story. 
        
        Instructions:
        1. Read & Analyze: Scan the story for a DIFFERENT 'Shocking' and 'Dramatic' point than the previous one.
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story. CRITICAL: Expressions must be REALISTIC HUMAN expressions. AVOID any unnatural distortions, pure white eyes, or horror-like facial features. Characters should look like real people in a high-stakes drama, not supernatural entities.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Bright, even midday sunlight" or "High-intensity diffused daylight". AVOID deep, harsh shadows or dark silhouettes on the ground or faces. The lighting should be clear and even across the whole scene.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        
        Story Content: "${currentPromptGeneration.storyTitle}"
        Previous Thumbnail Prompt: "${currentPromptGeneration.thumbnailPrompt}"
        
        Return ONLY the new, highly detailed image generation prompt.
      `;

      const output = await askAI(prompt);
      setCurrentPromptGeneration(prev => prev ? { ...prev, thumbnailPrompt: output.trim() } : null);
    } catch (error) {
      console.error("Story thumbnail rewrite error:", error);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const currentDisplayStory = showUrdu ? urduStory : story;

  return (
    <div className="min-h-screen font-sans bg-white text-black selection:bg-indigo-100">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center text-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="space-y-6"
            >
              <div className="w-24 h-24 mx-auto rounded-3xl premium-gradient flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-8">
                <Zap className="text-white w-12 h-12 fill-white" />
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                Welcome To The <span className="text-indigo-500">Premium Story Engine</span>
              </h1>
              <div className="space-y-2">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.3em]">
                  Powered by Mr-Furrukh
                </p>
                {isAuthLoading && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3 }}
                    className="h-1 bg-indigo-600 mx-auto rounded-full"
                    style={{ maxWidth: "200px" }}
                  />
                )}
              </div>

              {!user && !isAuthLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-md mx-auto space-y-6 pt-8 border-t border-white/10"
                >
                  <div className="space-y-2">
                    <h2 className="text-white text-lg font-bold">Secure Access</h2>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Experience the most powerful story engine ever built. <br/> Sign in to personalize your experience.
                    </p>
                  </div>

                  <Button 
                    className="w-full h-16 bg-white hover:bg-slate-100 text-black font-black rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 group"
                    onClick={handleGoogleLogin}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 group-hover:bg-white transition-colors">
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                        </div>
                        <span className="text-base">Sign in with Google</span>
                        <ArrowRight className="w-5 h-5 ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>No manual API keys required to start</span>
                  </div>
                </motion.div>
              )}

              {user && !showSplash && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-8 text-indigo-400 font-bold tracking-[0.2em] text-xs uppercase animate-pulse"
                >
                  Syncing Engine...
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 overflow-hidden opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200 blur-[120px]" />
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {(isGeneratingTitles || isGeneratingStory) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
            <h2 className="mt-8 text-2xl font-bold text-black tracking-tight">
              {isGeneratingTitles ? "Crafting Viral Titles..." : isGeneratingStory ? "Generating Premium Script..." : isGeneratingPrompts ? "Engineering Image Prompts..." : "Designing Viral Thumbnail..."}
            </h2>
            <p className="mt-2 text-slate-600 max-w-xs font-medium">
              Please wait while our AI engine builds your high-quality story structure.
            </p>
            <div className="mt-6 flex gap-2">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-black">Premium Story Engine</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Free For Life Time use</p>
          </div>
        </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-black">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                </div>
                {user.photoURL && (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                )}
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => logout()}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
            <Languages className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Urdu Mode</span>
            <Switch 
              checked={showUrdu} 
              onCheckedChange={setShowUrdu}
              disabled={!urduStory}
            />
          </div>
          <Button variant="outline" size="sm" className="rounded-full border-slate-200 hover:bg-slate-50 text-black font-bold" onClick={() => setActiveTab("settings")}>
            <SettingsIcon className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" className="rounded-full border-slate-200 hover:bg-slate-50 text-black font-bold" onClick={() => window.location.reload()}>
            <History className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input & Discovery */}
        <div className="lg:col-span-4 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <TabsTrigger value="input" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold text-[10px]">
                <Edit3 className="w-3 h-3 mr-1" />
                Input
              </TabsTrigger>
              <TabsTrigger value="reddit" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold text-[10px]">
                <Search className="w-3 h-3 mr-1" />
                Reddit
              </TabsTrigger>
              <TabsTrigger value="prompts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold text-[10px]">
                <ImageIcon className="w-3 h-3 mr-1" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="thumbnails" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" />
                Thumbnails
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold text-[10px]">
                <SettingsIcon className="w-3 h-3 mr-1" />
                Vault
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="h-1 premium-gradient" />
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <SettingsIcon className="w-5 h-5 text-indigo-600" />
                    Key Vault
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Save your API keys to your profile permanently.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider mb-1 px-1">Active Provider</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant={apiProvider === "gemini" ? "default" : "outline"} 
                          size="sm" 
                          className={cn("rounded-lg font-bold text-[10px] uppercase tracking-widest h-10", apiProvider === "gemini" && "bg-indigo-600")}
                          onClick={() => {
                            setApiProvider("gemini");
                            localStorage.setItem("API_PROVIDER", "gemini");
                          }}
                        >
                          Gemini
                        </Button>
                        <Button 
                          variant={apiProvider === "openrouter" ? "default" : "outline"} 
                          size="sm" 
                          className={cn("rounded-lg font-bold text-[10px] uppercase tracking-widest h-10", apiProvider === "openrouter" && "bg-indigo-600")}
                          onClick={() => {
                            setApiProvider("openrouter");
                            localStorage.setItem("API_PROVIDER", "openrouter");
                          }}
                        >
                          OpenRouter
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Google Gemini Key</label>
                        <div className="relative">
                          <Input 
                            type="password"
                            placeholder="AIza..."
                            value={profile?.customGeminiKey || apiKey}
                            onChange={(e) => {
                              const val = e.target.value;
                              setApiKey(val);
                              localStorage.setItem("GEMINI_API_KEY", val);
                              if (user) {
                                setDoc(doc(db, 'users', user.uid), { customGeminiKey: val }, { merge: true });
                              }
                            }}
                            className="bg-slate-50 border-slate-200 rounded-xl h-11 text-xs"
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium px-1">Stored securely in your private cloud profile.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">OpenRouter Key</label>
                        <Input 
                          type="password"
                          placeholder="sk-or-v1-..."
                          value={profile?.customOpenRouterKey || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (user) {
                              setDoc(doc(db, 'users', user.uid), { customOpenRouterKey: val }, { merge: true });
                            }
                          }}
                          className="bg-slate-50 border-slate-200 rounded-xl h-11 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 italic text-[10px] text-slate-400 text-center font-medium">
                    "Your keys are only used for your own story generations and are never shared."
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="input" className="mt-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    Draft Story
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Paste your content to generate titles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    placeholder="Paste your Reddit content or story ideas here..."
                    className="min-h-[300px] bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 text-black font-medium placeholder:text-slate-400"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <Button 
                    className="w-full premium-gradient text-white font-bold h-12 shadow-lg shadow-indigo-100 hover:opacity-90 transition-opacity"
                    onClick={() => generateTitles(inputText)}
                    disabled={!inputText || isGeneratingTitles}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Titles
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reddit" className="mt-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-black">Trending</CardTitle>
                    <CardDescription className="text-slate-500 font-medium">Top posts from r/HOA.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => fetchReddit()} disabled={isFetching} className="text-slate-500 hover:text-black">
                    <RefreshCw className={cn("w-5 h-5", isFetching && "animate-spin")} />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[450px] pr-4">
                    {isFetching ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100 animate-pulse">
                            <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                            <div className="h-3 w-1/2 bg-slate-100 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : redditPosts.length > 0 ? (
                      <div className="space-y-4">
                        {redditPosts.map(post => (
                          <motion.div 
                            key={post.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                            onClick={() => {
                              setInputText(post.text || post.title);
                              setActiveTab("input");
                            }}
                          >
                            <h3 className="text-sm font-bold text-black line-clamp-2 group-hover:text-indigo-600 transition-colors mb-2">
                              {post.title}
                            </h3>
                            <p className="text-xs text-slate-600 line-clamp-2 mb-3 font-medium">
                              {post.text || "No description available."}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                              <span>u/{post.author}</span>
                              <Badge variant="secondary" className="bg-white text-indigo-600 border-slate-200">
                                {post.upvotes} UP
                              </Badge>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-slate-400">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold">No posts found.</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts" className="mt-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-280px)] flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 shrink-0">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    Image Prompt Generator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col space-y-2 min-h-0">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Paste Story or Upload File</label>
                    <div className="flex-1 relative">
                      <Textarea 
                        placeholder="Paste your full story here..."
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        className="absolute inset-0 bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl font-medium overflow-y-auto resize-none p-3 pb-12"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <label className="cursor-pointer p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                          <Upload className="w-4 h-4 text-slate-600" />
                          <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-4 shrink-0">
                    <Button 
                      className="w-full premium-gradient text-white font-black rounded-xl shadow-lg shadow-indigo-100 h-12"
                      onClick={() => generateImagePrompts(promptInput)}
                      disabled={!promptInput || isGeneratingPrompts}
                    >
                      {isGeneratingPrompts ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate 50 Prompts
                        </>
                      )}
                    </Button>

                    {promptHistory.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                          <Clock className="w-3 h-3" />
                          Recent Generations
                        </div>
                        <ScrollArea className="h-[100px]">
                          <div className="space-y-2">
                            {promptHistory.map((gen) => (
                              <button
                                key={gen.id}
                                onClick={() => setCurrentPromptGeneration(gen)}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl border transition-all text-xs font-bold",
                                  currentPromptGeneration?.id === gen.id 
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                    : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200"
                                )}
                              >
                                <div className="truncate mb-1">{gen.storyTitle}</div>
                                <div className="text-[9px] opacity-60">{gen.timestamp}</div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="thumbnails" className="mt-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-280px)] flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 shrink-0">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Thumbnail Prompt Engineer
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col space-y-2 min-h-0">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Scene Idea</label>
                    <div className="flex-1 relative">
                      <Textarea 
                        placeholder="Describe your thumbnail idea (e.g., angry woman with trashcan)..."
                        value={thumbnailInput}
                        onChange={(e) => setThumbnailInput(e.target.value)}
                        className="absolute inset-0 bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl font-medium overflow-y-auto resize-none p-3 pb-12"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <label className="cursor-pointer p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                          <Upload className="w-4 h-4 text-slate-600" />
                          <input type="file" className="hidden" accept=".txt" onChange={handleThumbnailFileUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-4 shrink-0">
                    <Button 
                      className="w-full premium-gradient text-white font-black rounded-xl shadow-lg shadow-indigo-100 h-12"
                      onClick={() => generateThumbnailPrompt(thumbnailInput)}
                      disabled={!thumbnailInput || isGeneratingThumbnail}
                    >
                      {isGeneratingThumbnail ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate Thumbnail Prompt
                        </>
                      )}
                    </Button>

                    {thumbnailHistory.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                          <Clock className="w-3 h-3" />
                          Recent Thumbnails
                        </div>
                        <ScrollArea className="h-[100px]">
                          <div className="space-y-2">
                            {thumbnailHistory.map((gen) => (
                              <button
                                key={gen.id}
                                onClick={() => setCurrentThumbnailPrompt(gen)}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl border transition-all text-xs font-bold",
                                  currentThumbnailPrompt?.id === gen.id 
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                    : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200"
                                )}
                              >
                                <div className="truncate mb-1">{gen.input}</div>
                                <div className="text-[9px] opacity-60">{gen.timestamp}</div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Middle Column: Title Selection */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "titles" && titles.length > 0 && (
              <motion.div 
                key="titles-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                    <MousePointer2 className="w-6 h-6 text-indigo-600" />
                    Select Your Story Title
                  </h2>
                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none font-bold">
                    Step 2 of 3
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {titles.map((title, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => generateFullStory(title)}
                      className="w-full text-left p-6 rounded-2xl bg-white border-2 border-slate-100 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-100 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start gap-4">
                        <span className="text-indigo-600 font-mono font-bold text-lg mt-1">{(i + 1).toString().padStart(2, '0')}</span>
                        <p className="text-lg font-bold text-black leading-tight group-hover:text-indigo-700 transition-colors">
                          {title}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "output" && currentDisplayStory && (
              <motion.div 
                key="story-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Header Actions */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white border-none font-bold px-3 py-1">
                      {showUrdu ? "Urdu Script" : "English Script"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("titles")} className="text-slate-500 hover:text-black font-bold">
                      <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                      Change Title
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-slate-200 text-black font-bold hover:bg-slate-50" onClick={handleCopy}>
                      {copySuccess ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copySuccess ? "Copied!" : "Copy All"}
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-200 text-black font-bold hover:bg-slate-50" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* Selected Title Display */}
                <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-32 h-32" />
                  </div>
                  <h2 className="text-sm uppercase tracking-[0.3em] text-indigo-400 font-black mb-4">Selected Script Title</h2>
                  <p className={cn(
                    "text-3xl font-black leading-tight tracking-tight",
                    showUrdu && "urdu-text text-4xl"
                  )}>
                    {selectedTitle}
                  </p>
                </div>

                {/* Summary & Hook */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-slate-200 shadow-sm bg-indigo-50/30">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-widest text-indigo-600 font-black">The Hook (First 10s)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn(
                        "text-xl font-serif italic text-black leading-relaxed font-medium",
                        showUrdu && "urdu-text not-italic text-2xl"
                      )}>
                        "{currentDisplayStory.overallHook}"
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-black">Script Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn(
                        "text-sm text-slate-800 leading-relaxed font-medium",
                        showUrdu && "urdu-text text-lg"
                      )}>
                        {currentDisplayStory.summary}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Chapters Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-black flex items-center gap-2 ml-1">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    Script Chapters
                  </h3>
                  {currentDisplayStory.chapters.map((chapter) => (
                    <Card key={chapter.id} className="border-slate-200 shadow-sm group hover:border-indigo-200 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                            {chapter.id}
                          </div>
                          <CardTitle className={cn(
                            "text-md font-bold text-black",
                            showUrdu && "urdu-text text-xl"
                          )}>{chapter.title}</CardTitle>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-400 hover:text-indigo-600 font-bold"
                          onClick={() => setEditingChapterId(editingChapterId === chapter.id ? null : chapter.id)}
                        >
                          {editingChapterId === chapter.id ? "Save Changes" : "Edit Scene"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {editingChapterId === chapter.id ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Narrative Content</label>
                              <Textarea 
                                value={chapter.content}
                                onChange={(e) => updateChapter(chapter.id, "content", e.target.value)}
                                className={cn(
                                  "bg-slate-50 border-slate-200 min-h-[150px] text-black font-medium",
                                  showUrdu && "urdu-text text-xl"
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Chapter Twist</label>
                              <Input 
                                value={chapter.twist}
                                onChange={(e) => updateChapter(chapter.id, "twist", e.target.value)}
                                className={cn(
                                  "bg-slate-50 border-slate-200 text-black font-bold",
                                  showUrdu && "urdu-text text-xl"
                                )}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className={cn(
                              "text-slate-800 leading-relaxed text-base font-medium",
                              showUrdu && "urdu-text text-2xl"
                            )}>
                              {chapter.content}
                            </p>
                            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-4">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                                <Zap className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-indigo-600 font-black mb-1">Scene Twist</p>
                                <p className={cn(
                                  "text-sm font-bold text-indigo-900",
                                  showUrdu && "urdu-text text-xl"
                                )}>
                                  {chapter.twist}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "prompts" && currentPromptGeneration && (
              <motion.div 
                key="prompts-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ImageIcon className="w-32 h-32" />
                  </div>
                  <h2 className="text-sm uppercase tracking-[0.3em] text-indigo-400 font-black mb-4">Main Character Prompt</h2>
                  <p className="text-xl font-bold leading-relaxed text-slate-200">
                    {currentPromptGeneration.mainCharacterDescription}
                  </p>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="mt-6 bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                    onClick={() => {
                      navigator.clipboard.writeText(currentPromptGeneration.mainCharacterDescription);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Character Description
                  </Button>
                </div>

                {currentPromptGeneration.thumbnailPrompt && (
                  <div className="p-8 rounded-3xl bg-indigo-900 text-white shadow-2xl relative overflow-hidden border border-indigo-500/30">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles className="w-32 h-32" />
                    </div>
                    <h2 className="text-sm uppercase tracking-[0.3em] text-indigo-300 font-black mb-4">Viral Thumbnail Prompt</h2>
                    <p className="text-xl font-bold leading-relaxed text-indigo-50">
                      {currentPromptGeneration.thumbnailPrompt}
                    </p>
                    <div className="mt-6 flex gap-3">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                        onClick={() => {
                          navigator.clipboard.writeText(currentPromptGeneration.thumbnailPrompt!);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Thumbnail Prompt
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                        onClick={rewriteStoryThumbnail}
                        disabled={isGeneratingPrompts}
                      >
                        {isGeneratingPrompts ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Rewrite Prompt
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-black flex items-center gap-2 ml-1">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                      50 Scene Prompts
                    </h3>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-slate-200 text-black font-bold"
                        onClick={() => {
                          const text = currentPromptGeneration.prompts.map(p => `Scene ${p.sceneNumber}: ${p.description}`).join("\n\n");
                          navigator.clipboard.writeText(text);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-slate-200 text-black font-bold"
                        onClick={handleDownloadPrompts}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download TXT
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {currentPromptGeneration.prompts.map((p) => (
                      <Card key={p.sceneNumber} className="border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                        <CardContent className="p-6 flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0">
                            {p.sceneNumber}
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed font-medium">
                            {p.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "thumbnails" && currentThumbnailPrompt && (
              <motion.div 
                key="thumbnail-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="w-32 h-32" />
                  </div>
                  <h2 className="text-sm uppercase tracking-[0.3em] text-indigo-400 font-black mb-4">Thumbnail Generation Prompt</h2>
                  <p className="text-xl font-bold leading-relaxed text-slate-200">
                    {currentThumbnailPrompt.output}
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                      onClick={() => {
                        navigator.clipboard.writeText(currentThumbnailPrompt.output);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Prompt
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                      onClick={() => rewriteThumbnailPrompt(currentThumbnailPrompt.output, currentThumbnailPrompt.input)}
                      disabled={isGeneratingThumbnail}
                    >
                      {isGeneratingThumbnail ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Rewrite Prompt
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/10 hover:bg-white/20 border-none text-white font-bold"
                      onClick={() => {
                        const blob = new Blob([currentThumbnailPrompt.output], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `thumbnail-prompt-${Date.now()}.txt`;
                        a.click();
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download TXT
                    </Button>
                  </div>
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-black text-black">Original Idea</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 font-medium italic">"{currentThumbnailPrompt.input}"</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "input" && !titles.length && (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[600px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200"
              >
                <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center mb-8">
                  <Sparkles className="w-12 h-12 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-black text-black mb-4 tracking-tight">Ready to Craft?</h2>
                <p className="text-slate-500 max-w-sm font-bold text-lg leading-relaxed">
                  Paste your content on the left to generate premium titles and viral story scripts.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto p-12 mt-12 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-black text-black uppercase tracking-widest">Premium Story Engine</span>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          Powered by Mr-Furrukh • © 2026
        </p>
      </footer>
    </div>
  );
}

