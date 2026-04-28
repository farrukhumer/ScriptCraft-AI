export interface RedditPost {
  id: string;
  title: string;
  text: string;
  url: string;
  upvotes: number;
  num_comments: number;
  author: string;
}

export interface StoryChapter {
  id: number;
  title: string;
  content: string;
  twist: string;
}

export interface GeneratedStory {
  titles: string[];
  overallHook: string;
  summary: string;
  chapters: StoryChapter[];
}

export interface DetailedScenePrompt {
  sceneNumber: number;
  imagePrompt: string;
  visualPrompt: string;
}

export interface StoryHook {
  id: number;
  videoHookPrompt: string;
}

export interface PromptGeneration {
  id: string;
  timestamp: string;
  storyTitle: string;
  mainCharacterDescription: string;
  hooks: StoryHook[];
  scenes: DetailedScenePrompt[];
}

export interface ThumbnailPrompt {
  id: string;
  timestamp: string;
  input: string;
  output: string;
}
