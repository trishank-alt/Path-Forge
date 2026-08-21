"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Settings2,
  Key,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSettings: (settings: {
    provider: "gemini" | "openai" | "deterministic";
    apiKey: string;
    modelName: string;
  }) => void;
}

export function SettingsModal({ isOpen, onClose, onSaveSettings }: SettingsModalProps) {
  const [provider, setProvider] = useState<"gemini" | "openai" | "deterministic">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const storedProvider = sessionStorage.getItem("pathfinder_provider") as any;
    const storedKey = sessionStorage.getItem("pathfinder_api_key");
    const storedModel = sessionStorage.getItem("pathfinder_model");

    if (storedProvider) setProvider(storedProvider);
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setModelName(storedModel);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    sessionStorage.setItem("pathfinder_provider", provider);
    sessionStorage.setItem("pathfinder_api_key", apiKey);
    sessionStorage.setItem("pathfinder_model", modelName);

    onSaveSettings({ provider, apiKey, modelName });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">LLM Provider & API Settings</h3>
              <p className="text-xs text-slate-400">
                Google Gemini uses the server configuration by default.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Model Provider:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setProvider("gemini");
                  setModelName("gemini-2.5-flash");
                }}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  provider === "gemini"
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm glow-cyan"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="block font-bold">Google Gemini</span>
                <span className="text-[10px] text-slate-400">Primary / Flash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider("deterministic");
                  setModelName("rule-engine-v1");
                }}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  provider === "deterministic"
                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm glow-purple"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="block font-bold">Deterministic</span>
                <span className="text-[10px] text-slate-400">Instant / Offline</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider("openai");
                  setModelName("gpt-4o-mini");
                }}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  provider === "openai"
                    ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="block font-bold">OpenAI</span>
                <span className="text-[10px] text-slate-400">GPT-4o Mini</span>
              </button>
            </div>
          </div>

          {/* Model Name */}
          {provider !== "deterministic" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Model Name:</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* API Key Input */}
          {provider !== "deterministic" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{provider === "gemini" ? "Google Gemini API Key:" : "OpenAI API Key:"}</span>
                <span className="text-[10px] text-slate-400">Kept for this browser session only</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === "gemini"
                      ? "AIzaSy... (or set GEMINI_API_KEY in env)"
                      : "sk-... (or set OPENAI_API_KEY in env)"
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {provider === "deterministic" && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Zero-Latency Calibrated Rule Engine Active</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Uses the built-in fallback when no model provider is configured. It keeps the experience available, but questions will be less tailored.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md glow-cyan transition-all"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
