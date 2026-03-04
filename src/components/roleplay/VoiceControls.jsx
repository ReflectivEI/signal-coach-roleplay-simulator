/**
 * VoiceControls — mic button + TTS toggle + volume/speed sliders
 * Compact bar that sits inside the chat input row.
 */
import React, { useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VoiceControls({
  isListening,
  isSpeaking,
  sttSupported,
  ttsSupported,
  voiceSettings,
  onToggleMic,
  onStopSpeaking,
  onChangeSettings,
}) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      {/* Mic button */}
      {sttSupported && (
        <button
          type="button"
          onClick={onToggleMic}
          title={isListening ? "Stop recording" : "Speak your response"}
          className={`h-9 w-9 flex items-center justify-center rounded-md border transition-all ${
            isListening
              ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
              : "bg-white border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}

      {/* TTS toggle */}
      {ttsSupported && (
        <button
          type="button"
          onClick={() => onChangeSettings({ ...voiceSettings, ttsEnabled: !voiceSettings.ttsEnabled })}
          title={voiceSettings.ttsEnabled ? "Disable HCP voice" : "Enable HCP voice"}
          className={`h-9 w-9 flex items-center justify-center rounded-md border transition-all ${
            voiceSettings.ttsEnabled
              ? "bg-teal-50 border-teal-300 text-teal-600"
              : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
          }`}
        >
          {voiceSettings.ttsEnabled
            ? <Volume2 className="w-4 h-4" />
            : <VolumeX className="w-4 h-4" />}
        </button>
      )}

      {/* Stop speaking button — visible only while TTS is playing */}
      {isSpeaking && (
        <button
          type="button"
          onClick={onStopSpeaking}
          title="Stop speaking"
          className="h-9 w-9 flex items-center justify-center rounded-md border bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Settings gear */}
      {(sttSupported || ttsSupported) && (
        <button
          type="button"
          onClick={() => setShowPanel((p) => !p)}
          title="Voice settings"
          className="h-9 w-9 flex items-center justify-center rounded-md border bg-white border-gray-200 text-gray-400 hover:text-gray-600"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      )}

      {/* Settings panel */}
      {showPanel && (
        <div className="absolute bottom-12 right-0 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Voice Settings</span>
            <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {ttsSupported && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Volume: {Math.round(voiceSettings.volume * 100)}%</span>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={voiceSettings.volume}
                  onChange={(e) => onChangeSettings({ ...voiceSettings, volume: parseFloat(e.target.value) })}
                  className="accent-teal-500 w-full"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Speed: {voiceSettings.rate.toFixed(1)}×</span>
                <input
                  type="range" min="0.5" max="1.8" step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => onChangeSettings({ ...voiceSettings, rate: parseFloat(e.target.value) })}
                  className="accent-teal-500 w-full"
                />
              </label>
            </>
          )}

          {!sttSupported && (
            <p className="text-xs text-gray-400">Speech input not supported in this browser.</p>
          )}
          {!ttsSupported && (
            <p className="text-xs text-gray-400">Text-to-speech not supported in this browser.</p>
          )}
        </div>
      )}
    </div>
  );
}