import React, { useState } from 'react';
import { ANDROID_FILES, CodeFile } from '../androidCodeData';
import {
  FileCode,
  Copy,
  Check,
  Download,
  FolderTree,
  Terminal,
  Cpu,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import JSZip from 'jszip';

export const AndroidCodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(ANDROID_FILES[5]); // Default to HomographyObstacleEngine.kt
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAllAsZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Root directory files
      zip.file('settings.gradle.kts', ANDROID_FILES[0].content);
      zip.file('gradle.properties', ANDROID_FILES[1].content);
      zip.file('build.gradle.kts', ANDROID_FILES[2].content);
      zip.file('deploy.ps1', ANDROID_FILES[9].content);

      // App module
      const app = zip.folder('app');
      if (app) {
        app.file('build.gradle.kts', ANDROID_FILES[3].content);
        const main = app.folder('src')?.folder('main');
        if (main) {
          main.file('AndroidManifest.xml', ANDROID_FILES[4].content);
          const java = main.folder('java')?.folder('com')?.folder('pathsense')?.folder('app');
          if (java) {
            java.file('ImuTracker.kt', ANDROID_FILES[5].content);
            java.file('HomographyObstacleEngine.kt', ANDROID_FILES[6].content);
            java.file('DebugHudView.kt', ANDROID_FILES[7].content);
            java.file('EdgeAlertService.kt', ANDROID_FILES[8].content);
            java.file('MainActivity.kt', ANDROID_FILES[9].content);
          }
          const layout = main.folder('res')?.folder('layout');
          if (layout) {
            layout.file('activity_main.xml', ANDROID_FILES[10].content);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'PathSense-Android-Kotlin.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hardware & Spec Target Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/40">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Host Hardware Cap</div>
            <div className="text-sm font-bold text-slate-200">Intel Core i3-1215U (8 GB RAM)</div>
            <div className="text-[11px] text-emerald-400 font-mono">1.5GB Heap | Zero CMake</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Target Physical Device</div>
            <div className="text-sm font-bold text-slate-200">Vivo T3 5G (Android 16)</div>
            <div className="text-[11px] text-sky-400 font-mono">OriginOS 6 • ARM64-v8a</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/40">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Computer Vision Runtime</div>
            <div className="text-sm font-bold text-slate-200">Pre-compiled OpenCV 4.5.3 AAR</div>
            <div className="text-[11px] text-purple-400 font-mono">CameraX 30 FPS • &lt;8ms/frame</div>
          </div>
        </div>
      </div>

      {/* Main Code Viewer Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: File Tree & Deliverables List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-sky-400" />
              Deliverables Tree
            </span>
            <button
              type="button"
              onClick={downloadAllAsZip}
              disabled={isZipping}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isZipping ? 'Zipping...' : 'Download ZIP'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
            {ANDROID_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-sky-950/80 border-sky-500/80 text-sky-100 font-medium'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="font-mono truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 pl-5.5">{file.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code Editor & Copy Area */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-sky-300 border border-slate-700">
                {selectedFile.language.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-slate-300 font-semibold">
                {selectedFile.path}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy File</span>
                </>
              )}
            </button>
          </div>

          {/* Code text content */}
          <div className="p-4 overflow-x-auto max-h-[620px] bg-slate-950/90 font-mono text-[11.5px] leading-relaxed text-slate-300 selection:bg-sky-900">
            <pre>
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
