
import React, { createContext, useState, useContext, ReactNode, useRef, useMemo, useCallback } from 'react';
import * as webllm from "@mlc-ai/web-llm";
import { useHistory } from './HistoryContext';
import { useSubscription } from './SubscriptionContext';
import { buildUserProfile, inferTopInterests } from '../utils/xrai';
import type { Video } from '../types';

// Use Phi-3.5-mini-instruct for high performance (12B equivalent reasoning) with low VRAM usage
const SELECTED_MODEL = "Phi-3.5-mini-instruct-q4f16_1-MLC"; 

interface AiContextType {
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: string;
  initializeEngine: () => Promise<void>;
  getAiRecommendations: () => Promise<string[]>;
  discoveryVideoCache: React.MutableRefObject<Video[]>;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export const AiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState('');
  
  const engine = useRef<webllm.MLCEngine | null>(null);
  const discoveryVideoCache = useRef<Video[]>([]); // Cache for discovered videos to prevent reload flickering

  const { history } = useHistory();
  const { subscribedChannels } = useSubscription();

  const initializeEngine = useCallback(async () => {
    if (engine.current || isLoading) return;
    
    setIsLoading(true);
    setLoadProgress('エンジンの初期化中...');

    try {
      const initProgressCallback = (report: webllm.InitProgressReport) => {
        setLoadProgress(report.text);
      };

      // Explicitly configure app config to ensure caching is used
      const appConfig: webllm.AppConfig = {
        ...webllm.prebuiltAppConfig,
        useIndexedDBCache: true,
      };

      const newEngine = await webllm.CreateMLCEngine(
        SELECTED_MODEL,
        { 
            initProgressCallback: initProgressCallback,
            appConfig: appConfig
        }
      );

      engine.current = newEngine;
      setIsLoaded(true);

    } catch (error) {
      console.error("Failed to load WebLLM:", error);
      setLoadProgress('AIエンジンのロードに失敗しました。WebGPU対応ブラウザか確認してください。');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);
  
  // Generates search queries based on user profile (Analysis Only)
  const getAiRecommendations = useCallback(async (): Promise<string[]> => {
    if (!engine.current) {
        await initializeEngine();
    }
    if (!engine.current) return [];

    const profile = buildUserProfile({
        watchHistory: history,
        searchHistory: [],
        subscribedChannels: subscribedChannels
    });
    const interests = inferTopInterests(profile, 15);
    const recentTitles = history.slice(0, 5).map(v => v.title).join('", "');
    
    // Prompt engineering for "YouTube-like" discovery (New Channels, Adjacent Genres)
    const prompt = `
    You are a YouTube recommendation algorithm used for CONTENT DISCOVERY.
    User's core interests: [${interests.join(', ')}].
    Recently watched: ["${recentTitles}"].

    Task: Generate 5 specific YouTube search queries to help the user discover NEW channels and RELATED genres they haven't seen yet.
    Rules:
    1. Focus on ADJACENT niches (e.g., if "Minecraft", suggest "Terraria" or "Indie Sandbox").
    2. Do NOT suggest what they already watch. Suggest "Fresh" or "Rising" topics.
    3. Include terms like "Video Essay", "Review", "Documentary", or specific genres.
    4. Output ONLY the 5 queries, one per line. No numbering.
    `;

    try {
        const reply = await engine.current.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8, // Higher temperature for more diversity
            max_tokens: 150,
        });
        
        const content = reply.choices[0].message.content || '';
        // Split by newlines and clean up
        const queries = content.split('\n')
            .map(line => line.replace(/^\d+\.\s*/, '').replace(/^- \s*/, '').replace(/"/g, '').trim())
            .filter(line => line.length > 0);
            
        return queries.slice(0, 5);
    } catch (e) {
        console.error("Recommendation generation failed", e);
        return interests.slice(0, 5);
    }
  }, [history, subscribedChannels, initializeEngine]);

  const value = useMemo(() => ({
    isLoaded, 
    isLoading, 
    loadProgress, 
    initializeEngine, 
    getAiRecommendations,
    discoveryVideoCache
  }), [isLoaded, isLoading, loadProgress, initializeEngine, getAiRecommendations]);

  return (
    <AiContext.Provider value={value}>
      {children}
    </AiContext.Provider>
  );
};

export const useAi = (): AiContextType => {
  const context = useContext(AiContext);
  if (context === undefined) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return context;
};