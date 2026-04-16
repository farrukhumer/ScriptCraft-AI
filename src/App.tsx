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
import { ai, STORY_MODEL } from "@/src/lib/gemini";
import * as React from "react"
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

  // Image Prompt Generator State
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

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["titles"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      setTitles(result.titles);
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

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
        }
      });

      const result = JSON.parse(response.text || "{}");
      const fullStory: GeneratedStory = {
        titles: titles, // Keep original titles
        ...result
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

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
        }
      });

      const result = JSON.parse(response.text || "{}") as GeneratedStory;
      setUrduStory(result);
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
           - Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story.
           - Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
           - Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
           - Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
           - Lighting: STRICTLY DAYTIME. Use "Flat, shadowless high-key lighting" or "Bright overcast daylight". ABSOLUTELY NO SHADOWS on the ground, faces, or environment. The entire scene must be perfectly lit with zero dark spots or silhouettes.
           - Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
           - Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
           - CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        3. "prompts": Generate exactly 50 scene-by-scene prompts.
        4. CHARACTER CONSISTENCY & PRESENCE: For every scene where the main character is present, start the prompt with the concise description created in step 1. 
           CRITICAL RULE: If the character is NOT present in a specific scene, DO NOT include their name or physical description at all. Only describe the environment, the action, the camera angle, and the lighting.
        5. CINEMATIC FOCUS: Focus 60% of each prompt on the cinematic camera angle (e.g., low angle, close-up, wide shot), detailed environment, lighting (e.g., moody, neon, harsh shadows), and the suspenseful/eerie mood of the scene.
        
        Output must be in JSON format.
      `;

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
        }
      });

      const result = JSON.parse(response.text || "{}");
      const newGeneration: PromptGeneration = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        storyTitle: text.slice(0, 50) + "...",
        ...result
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
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Flat, shadowless high-key lighting" or "Bright overcast daylight". ABSOLUTELY NO SHADOWS on the ground, faces, or environment. The entire scene must be perfectly lit with zero dark spots or silhouettes.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.

        User Idea: "${text}"

        Output Format:
        Return ONLY the final, highly detailed image generation prompt. Do not add conversational text.
      `;

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = response.text || "";
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
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Flat, shadowless high-key lighting" or "Bright overcast daylight". ABSOLUTELY NO SHADOWS on the ground, faces, or environment. The entire scene must be perfectly lit with zero dark spots or silhouettes.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        
        Original Idea: "${originalInput}"
        Previous Prompt: "${currentPrompt}"
        
        Return ONLY the new, improved, highly detailed image generation prompt.
      `;

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = response.text || "";
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
        2. Scene Selection: Imagine a 'Clickbait' scene with 2-3 full-body human characters. ALL characters in the scene must have extreme, dramatic facial expressions (shock, anger, or evil smirks) relevant to the story.
        3. Camera & Composition: Use a WIDE-ANGLE shot. The camera must be far enough to show the FULL BODY of the characters and the surrounding suburban environment. DO NOT zoom in too close.
        4. Visual Style: Photorealistic cinematic style with a hint of high-end 3D render polish (balanced for realism). Avoid looking like a cartoon or pure 3D model.
        5. Environment: Vibrant deep blue sky, lush high-contrast greenery (grass and trees), and saturated sharp colors for the entire suburban setting to match the character contrast.
        6. Lighting: STRICTLY DAYTIME. Use "Flat, shadowless high-key lighting" or "Bright overcast daylight". ABSOLUTELY NO SHADOWS on the ground, faces, or environment. The entire scene must be perfectly lit with zero dark spots or silhouettes.
        7. Quality Tags: Include: '8k, ultra-detailed, photorealistic, sharp focus, wide-angle lens, HDR, intense cinematic atmosphere, sharp textures, high-quality skin render'.
        8. Strict Rule: NO text, subtitles, or letters. Focus ONLY on visual storytelling.
        9. CRITICAL: SINGLE SCENE ONLY. NO SPLIT-SCREEN.
        
        Story Content: "${currentPromptGeneration.storyTitle}"
        Previous Thumbnail Prompt: "${currentPromptGeneration.thumbnailPrompt}"
        
        Return ONLY the new, highly detailed image generation prompt.
      `;

      const response = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = (response.text || "").trim();
      setCurrentPromptGeneration(prev => prev ? { ...prev, thumbnailPrompt: output } : null);
    } catch (error) {
      console.error("Story thumbnail rewrite error:", error);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const currentDisplayStory = showUrdu ? urduStory : story;

  return (
    <div className="min-h-screen font-sans bg-white text-black selection:bg-indigo-100">
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
            <h1 className="text-xl font-bold tracking-tight text-black">ScriptCraft AI</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Premium Story Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
            <Languages className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Urdu Mode</span>
            <Switch 
              checked={showUrdu} 
              onCheckedChange={setShowUrdu}
              disabled={!urduStory}
            />
          </div>
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
            </TabsList>

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
          <span className="text-sm font-black text-black uppercase tracking-widest">ScriptCraft AI</span>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          Premium Content Engine • Powered by Gemini Pro • © 2026
        </p>
      </footer>
    </div>
  );
}

