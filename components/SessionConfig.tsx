"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSessionStore, type Language, type Mode, type Scenario } from "@/store/useSessionStore";

interface SessionConfigProps {
  onStartSession: () => void;
  disabled?: boolean;
}

export function SessionConfig({ onStartSession, disabled }: SessionConfigProps) {
  const { mode, language, scenario, setMode, setLanguage, setScenario } =
    useSessionStore();

  return (
    <div className="space-y-6">
      {/* Scenario Card */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="text-lg">🎭</span> Scenario
        </Label>
        <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
          <SelectTrigger className="h-14 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10">
            <SelectItem value="interview" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              <span className="flex items-center gap-2">💼 Job Interview</span>
            </SelectItem>
            <SelectItem value="sales" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              <span className="flex items-center gap-2">🎯 Sales Pitch</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-600 dark:text-slate-400 ml-1">
          {scenario === 'interview' 
            ? '✨ Practice answering interview questions' 
            : '✨ Practice your B2B sales pitch'}
        </p>
      </div>

      {/* Difficulty Card */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="text-lg">⚡</span> Difficulty
        </Label>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-14 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10">
            <SelectItem value="easy" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              🟢 Easy (with hints)
            </SelectItem>
            <SelectItem value="normal" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              🟡 Normal (guided)
            </SelectItem>
            <SelectItem value="hard" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              🔴 Hard (realistic)
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-600 dark:text-slate-400 ml-1">
          {mode === 'easy' 
            ? '✨ Helpful hints and encouragement' 
            : mode === 'normal'
            ? '✨ Subtle guidance when needed'
            : '✨ Realistic challenge, no hints'}
        </p>
      </div>

      {/* Language Card */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="text-lg">🌍</span> Language
        </Label>
        <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
          <SelectTrigger className="h-14 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10">
            <SelectItem value="en" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              🇬🇧 English
            </SelectItem>
            <SelectItem value="de" className="hover:bg-white/80 dark:hover:bg-slate-800/80">
              🇩🇪 Deutsch
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Glass Button */}
      <Button 
        onClick={onStartSession} 
        disabled={disabled} 
        className="w-full h-14 text-base font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-2xl shadow-purple-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-0"
      >
        {disabled ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⚙️</span> Starting...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Start Session <span className="text-lg">→</span>
          </span>
        )}
      </Button>
    </div>
  );
}




