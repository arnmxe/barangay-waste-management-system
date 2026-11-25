"use client";

import React, { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

interface PhotoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  disabled?: boolean;
}

export function PhotoUploader({
  value,
  onChange,
  label = "Attach Photo (optional, max 2 MB JPEG/PNG/WEBP)",
  disabled = false,
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image exceeds the 2 MB size limit.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
      } else {
        onChange(data.url);
      }
    } catch {
      setError("Cannot upload photo while offline.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${
            disabled || uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#166534]" />
          ) : (
            <Camera className="h-4 w-4 text-[#166534]" />
          )}
          <span>{uploading ? "Uploading..." : value ? "Change Photo" : "Upload Photo"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="sr-only"
          />
        </label>

        {value && (
          <div className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded evidence"
              className="h-12 w-12 rounded-lg object-cover border border-slate-200"
            />
            <span className="text-xs font-medium text-green-800">Photo attached</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Remove photo"
                className="ml-1 rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
