"use client";

import React, { useState, useEffect } from "react";
import { ParentProfile, VoiceHealthConfig, CallTranscriptTurn } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  PhoneOff,
  Radio,
  User,
  Bot,
  RefreshCw,
} from "lucide-react";

interface WebVoiceSimulatorProps {
  profile: ParentProfile;
  config: VoiceHealthConfig;
  onFinishSession: (transcript: CallTranscriptTurn[]) => void;
  onClose: () => void;
}

export function WebVoiceSimulator({
  profile,
  config,
  onFinishSession,
  onClose,
}: WebVoiceSimulatorProps) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<CallTranscriptTurn[]>([]);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  // Scripted conversational turns for realistic browser simulation
  const conversationScript = [
    {
      agent: `Namaste ${profile.honorific}! Main Anya bol rahi hoon, ${profile.childName} ne aapka haal-chaal lene ke liye kaha tha. Aaj aap kaisa mehsoos kar rahe hain?`,
      user: `Namaste beta. Theek hoon, bas subah se ghutne mein thodi zyaada stiffness hai.`,
    },
    {
      agent: `Arey, dhyaan rakhiye Ji. Kya aapne subah wali Telmisartan aur Metformin time par le li thi?`,
      user: `Haan davaai toh time par le li thi. Par chalne mein thodi taqleef thi.`,
    },
    {
      agent: `Accha Ji, aap thoda aaram karein aur seedhiyon ka istemaal kam karein. Main ${profile.childName} ko bata doongi taaki woh shaam ko aap se baat karein. Khyaal rakhiyega!`,
      user: `Theek hai beta, thank you. Namaste.`,
    },
  ];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isActive && transcript.length === 0) {
      // Step 1: Agent speaks greeting
      setIsAgentSpeaking(true);
      timeout = setTimeout(() => {
        setTranscript([{ role: "agent", text: conversationScript[0].agent }]);
        setIsAgentSpeaking(false);
      }, 1500);
    }
    return () => clearTimeout(timeout);
  }, [isActive]);

  const handleSimulateUserTurn = () => {
    if (!isActive) return;
    const currentStep = Math.floor(transcript.length / 2);

    if (currentStep < conversationScript.length) {
      const userText = conversationScript[currentStep].user;
      setTranscript((prev) => [...prev, { role: "user", text: userText }]);

      // Agent responds after a short pause
      setIsAgentSpeaking(true);
      setTimeout(() => {
        if (currentStep + 1 < conversationScript.length) {
          setTranscript((prev) => [
            ...prev,
            { role: "agent", text: conversationScript[currentStep + 1].agent },
          ]);
        } else {
          setTranscript((prev) => [
            ...prev,
            {
              role: "agent",
              text: `Bilkul ${profile.honorific}, apna dhyaan rakhiye. Namaste!`,
            },
          ]);
        }
        setIsAgentSpeaking(false);
      }, 1800);
    }
  };

  const handleEndSession = () => {
    setIsActive(false);
    onFinishSession(transcript);
    onClose();
  };

  return (
    <Card className="border-teal-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-xl bg-teal-500/20 flex items-center justify-center">
            <Radio className="h-4 w-4 text-teal-400 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-100">
              Web Voice Simulator (Browser Mic Mode)
            </CardTitle>
            <p className="text-xs text-slate-400">
              Testing Sarvam Voice Agent in {profile.preferredLanguage} with {profile.honorific}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-xs">
            {isActive ? (isAgentSpeaking ? "Anya Speaking..." : "Listening...") : "Ready"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs text-slate-400">
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {!isActive ? (
          <div className="text-center py-6 space-y-3">
            <div className="h-14 w-14 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
              <Mic className="h-7 w-7 text-teal-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-100">
              Test Anya Voice Agent in your browser
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Interact with the agent as {profile.honorific} without using telephony credits.
            </p>
            <Button
              variant="default"
              size="default"
              onClick={() => setIsActive(true)}
              className="font-semibold shadow-lg shadow-teal-500/20"
            >
              Start Browser Voice Session
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Visualizer Bar */}
            <div className="h-16 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center space-x-1.5 px-4 text-teal-400">
              {isAgentSpeaking ? (
                <>
                  <span className="soundwave-bar" style={{ animationDelay: "0ms" }} />
                  <span className="soundwave-bar" style={{ animationDelay: "200ms" }} />
                  <span className="soundwave-bar" style={{ animationDelay: "400ms" }} />
                  <span className="soundwave-bar" style={{ animationDelay: "100ms" }} />
                  <span className="soundwave-bar" style={{ animationDelay: "300ms" }} />
                  <span className="soundwave-bar" style={{ animationDelay: "50ms" }} />
                </>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Mic className="h-4 w-4 text-emerald-400 animate-pulse" />
                  <span>Your Turn: Speak or click &quot;Simulate Parent Turn&quot;</span>
                </div>
              )}
            </div>

            {/* Live Transcript Log */}
            <div className="max-h-48 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              {transcript.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-2 text-xs ${
                    turn.role === "agent" ? "text-teal-200" : "text-slate-200"
                  }`}
                >
                  <div className="h-5 w-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {turn.role === "agent" ? (
                      <Bot className="h-3 w-3 text-teal-400" />
                    ) : (
                      <User className="h-3 w-3 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 mr-1.5">
                      {turn.role === "agent" ? "Anya:" : `${profile.honorific}:`}
                    </span>
                    <span>{turn.text}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateUserTurn}
                disabled={isAgentSpeaking}
                className="text-xs border-teal-500/30 text-teal-300 hover:bg-teal-500/10"
              >
                <Mic className="h-3.5 w-3.5 mr-1.5" />
                Simulate Parent Response
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndSession}
                className="text-xs font-semibold"
              >
                <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
                End Session & Analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
