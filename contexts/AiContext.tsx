import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import * as webllm from "@mlc-ai/web-llm";
import { useHistory } from './HistoryContext';
import { useSubscription } from './SubscriptionContext';
import { buildUserProfile, inferTopInterests } from '../utils/xrai';

// Use Phi-3.5-mini-instruct for high performance (12B equivalent reasoning) with low VRAM usage
const SELECTED_MODEL = "Phi-3.5-mini-instruct-q4f16_1-MLC"; 

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiContextType {
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: string;
  messages: Message[];
  initializeEngine: () => Promise<void>;
  getAiRecommendations: () => Promise<string[]>;
  sendMessage: (text: string) => Promise<void>;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export const AiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const engine = useRef<webllm.MLCEngine | null>(null);
  const { history } = useHistory();
  const { subscribedChannels } = useSubscription();

  const initializeEngine = async () => {
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
      setMessages([{ role: 'assistant', content: 'こんにちは！動画探しのお手伝いをします。何でも聞いてください。' }]);

    } catch (error) {
      console.error("Failed to load WebLLM:", error);
      setLoadProgress('AIエンジンのロードに失敗しました。WebGPU対応ブラウザか確認してください。');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generates search queries based on user profile (Analysis Only)
  const getAiRecommendations = async (): Promise<string[]> => {
    if (!engine.current) {
        await initializeEngine();
    }
    if (!engine.current) return [];

    const profile = buildUserProfile({
        watchHistory: history,
        searchHistory: [],
        subscribedChannels: subscribedChannels
    });
    const interests = inferTopInterests(profile, 10);
    
    const prompt = `
    Analyze the user's interests: ${interests.join(', ')} and recent history: ${history.slice(0,3).map(v => v.title).join(', ')}.
    Based on this analysis, generate 5 unique, creative, and specific search queries for YouTube to help them discover NEW content.
    Do not number the list. Just output 5 lines of search terms. Japanese or English.
    `;

    try {
        const reply = await engine.current.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 100,
        });
        
        const content = reply.choices[0].message.content || '';
        // Split by newlines and clean up
        const queries = content.split('\n')
            .map(line => line.replace(/^\d+\.\s*/, '').replace(/^- \s*/, '').trim())
            .filter(line => line.length > 0);
            
        return queries.slice(0, 5);
    } catch (e) {
        console.error("Recommendation generation failed", e);
        return interests.slice(0, 5);
    }
  };

  const sendMessage = async (text: string) => {
      if (!engine.current || !text.trim()) return;

      const newMessages: Message[] = [...messages, { role: 'user', content: text }];
      setMessages(newMessages);

      try {
          const historyContext = history.slice(0, 10).map(v => v.title).join(', ');
          const systemPrompt = `You are a helpful YouTube video assistant. The user has watched recently: ${historyContext}. Answer in Japanese if the user asks in Japanese. Be concise.`;
          
          const completionMessages = [
              { role: 'system', content: systemPrompt },
              ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ];

          const reply = await engine.current.chat.completions.create({
              messages: completionMessages as any,
              temperature: 0.7,
              max_tokens: 512,
          });
          
          const responseContent = reply.choices[0].message.content || "";
          setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
      } catch (e) {
           console.error("Chat completion failed", e);
           setMessages(prev => [...prev, { role: 'assistant', content: "エラーが発生しました。" }]);
      }
  };

  return (
    <AiContext.Provider value={{ isLoaded, isLoading, loadProgress, messages, initializeEngine, getAiRecommendations, sendMessage }}>
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