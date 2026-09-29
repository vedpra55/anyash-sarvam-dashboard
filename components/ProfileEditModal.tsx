"use client";

import React, { useState, useEffect } from "react";
import { ParentProfile, SupportedLanguage } from "@/lib/types";
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

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ParentProfile;
  onSave: (updated: ParentProfile) => void;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: ProfileEditModalProps) {
  const [form, setForm] = useState<ParentProfile>(profile);
  const [conditionsInput, setConditionsInput] = useState("");

  useEffect(() => {
    setForm(profile);
    setConditionsInput(profile.knownConditions.join(", "));
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ParentProfile = {
      ...form,
      knownConditions: conditionsInput
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    };
    onSave(updated);
    onClose();
  };

  const languages: SupportedLanguage[] = [
    "Hindi",
    "Hinglish",
    "English",
    "Tamil",
    "Telugu",
    "Marathi",
    "Bengali",
    "Kannada",
    "Gujarati",
    "Punjabi",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-100">
            Configure Parent Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parentName">Parent Name</Label>
              <Input
                id="parentName"
                value={form.parentName}
                onChange={(e) =>
                  setForm({ ...form, parentName: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="honorific">Honorific</Label>
              <Input
                id="honorific"
                placeholder="Mummy Ji / Uncle Ji"
                value={form.honorific}
                onChange={(e) =>
                  setForm({ ...form, honorific: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone">Phone Number</Label>
              <Input
                id="parentPhone"
                placeholder="+919876543210"
                value={form.parentPhone}
                onChange={(e) =>
                  setForm({ ...form, parentPhone: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredLanguage">Language</Label>
              <select
                id="preferredLanguage"
                value={form.preferredLanguage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    preferredLanguage: e.target.value as SupportedLanguage,
                  })
                }
                className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="childName">Child Name (Buyer)</Label>
              <Input
                id="childName"
                value={form.childName}
                onChange={(e) =>
                  setForm({ ...form, childName: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childPhone">Child WhatsApp</Label>
              <Input
                id="childPhone"
                value={form.childPhone}
                onChange={(e) =>
                  setForm({ ...form, childPhone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conditions">
              Known Conditions (comma-separated)
            </Label>
            <Input
              id="conditions"
              placeholder="Diabetes Type 2, Knee Arthritis, Hypertension"
              value={conditionsInput}
              onChange={(e) => setConditionsInput(e.target.value)}
            />
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
              Save Profile Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
