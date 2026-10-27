/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DebugSimulator } from './components/DebugSimulator';
import { DoomscrollOverlaySimulator } from './components/DoomscrollOverlaySimulator';
import { AndroidCodeExplorer } from './components/AndroidCodeExplorer';
import { ArchitectureDoc } from './components/ArchitectureDoc';
import {
  ShieldAlert,
  Eye,
  FileCode2,
  BookOpen,
  Cpu,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'overlay' | 'code' | 'architecture'>('simulator');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-600/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">PathSense</h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950 text-sky-400 border border-sky-800/60">
                  v1.0.0 Android 16
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ultra-Low-Latency Footpath Obstacle & Pothole Detector
              </p>
            </div>
          </div>

          {/* Quick Hardware Badges */}
          <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Core i3-1215U (8GB RAM)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vivo T3 5G (Android 16)</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Mode 1: Visual Debug HUD
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overlay')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overlay'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mode 2: "Doomscroll Safe" Background Overlay
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'code'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Android Kotlin Project Files (1-9)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            CV & IMU Math Architecture
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'simulator' && <DebugSimulator />}
        {activeTab === 'overlay' && <DoomscrollOverlaySimulator />}
        {activeTab === 'code' && <AndroidCodeExplorer />}
        {activeTab === 'architecture' && <ArchitectureDoc />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-500 font-mono">
        PathSense • Classical Geometric Optical Flow & Homography • Pre-compiled OpenCV 4.5.3 AAR • Android 16 OriginOS 6
      </footer>
    </div>
  );
}
