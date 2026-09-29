"use client";

import React, { useState, useEffect } from "react";
import { VoiceHealthConfig } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { KeyRound, Phone, Server, ShieldCheck } from "lucide-react";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceHealthConfig;
  onSave: (updated: VoiceHealthConfig) => void;
}

export function ConfigModal({
  isOpen,
  onClose,
  config,
  onSave,
}: ConfigModalProps) {
  const [form, setForm] = useState<VoiceHealthConfig>(config);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Server className="h-4 w-4 text-teal-400" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-100">
              Sarvam Voice & Telephony Config
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure Sarvam Voice Agents credentials and telephony connections.
            All keys are saved securely in your browser&apos;s localStorage.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Sarvam API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sarvamApiKey">Sarvam API Subscription Key</Label>
              <span className="text-[10px] text-slate-500">From dashboard.sarvam.ai</span>
            </div>
            <Input
              id="sarvamApiKey"
              type="password"
              placeholder="sk_..."
              value={form.sarvamApiKey}
              onChange={(e) =>
                setForm({ ...form, sarvamApiKey: e.target.value })
              }
            />
          </div>

          {/* Org & Workspace IDs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sarvamOrgId">Sarvam Org ID</Label>
              <Input
                id="sarvamOrgId"
                placeholder="org_..."
                value={form.sarvamOrgId}
                onChange={(e) =>
                  setForm({ ...form, sarvamOrgId: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sarvamWorkspaceId">Workspace ID</Label>
              <Input
                id="sarvamWorkspaceId"
                placeholder="ws_..."
                value={form.sarvamWorkspaceId}
                onChange={(e) =>
                  setForm({ ...form, sarvamWorkspaceId: e.target.value })
                }
              />
            </div>
          </div>

          {/* App ID & Version */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sarvamAppId">Voice Agent App ID</Label>
              <Input
                id="sarvamAppId"
                placeholder="app_..."
                value={form.sarvamAppId}
                onChange={(e) =>
                  setForm({ ...form, sarvamAppId: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sarvamAppVersion">App Version</Label>
              <Input
                id="sarvamAppVersion"
                type="number"
                value={form.sarvamAppVersion}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sarvamAppVersion: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>

          {/* Telephony Connection */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-slate-300">Telephony Settings</span>
              </div>
              <Badge variant="outline" className="text-[10px] text-teal-400 border-teal-500/30">
                Outbound Calls
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="connectionId">Connection ID</Label>
                <Input
                  id="connectionId"
                  placeholder="conn_... (Vobiz/Twilio)"
                  value={form.connectionId}
                  onChange={(e) =>
                    setForm({ ...form, connectionId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentPhoneNumber">Agent Caller Phone Number</Label>
                <Input
                  id="agentPhoneNumber"
                  placeholder="+9180XXXXXXXX"
                  value={form.agentPhoneNumber}
                  onChange={(e) =>
                    setForm({ ...form, agentPhoneNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telephonyProvider">Telephony Provider</Label>
              <select
                id="telephonyProvider"
                value={form.telephonyProvider}
                onChange={(e) =>
                  setForm({
                    ...form,
                    telephonyProvider: e.target.value as any,
                  })
                }
                className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <option value="sarvam_vobiz">Rent from Sarvam (Vobiz)</option>
                <option value="twilio">Twilio (BYOT)</option>
                <option value="exotel">Exotel (BYOT)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" variant="default" className="text-xs font-bold">
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
