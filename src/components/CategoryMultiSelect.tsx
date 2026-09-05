import React, { useState, useRef, useEffect } from "react";
import { EVENT_CATEGORY_OPTIONS } from "../constants/eventCategories";
import { ChevronDown, Check, X, Tag } from "lucide-react";

interface CategoryMultiSelectProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  label?: string;
}

export const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({
  selectedCategories,
  onChange,
  label = "Category / Focus Areas (Select one or more)",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategory = (optLabel: string) => {
    if (selectedCategories.includes(optLabel)) {
      const next = selectedCategories.filter((c) => c !== optLabel);
      onChange(next.length > 0 ? next : ["General Announcement"]);
    } else {
      const cleaned = selectedCategories.filter((c) => c !== "General Announcement");
      onChange([...cleaned, optLabel]);
    }
  };

  const removeCategory = (optLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedCategories.filter((c) => c !== optLabel);
    onChange(next.length > 0 ? next : ["General Announcement"]);
  };

  const filteredOptions = EVENT_CATEGORY_OPTIONS.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-2 font-normal" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
          {selectedCategories.length} selected
        </span>
      </div>

      {/* Selected Tags Display */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {selectedCategories.map((cat) => {
            const found = EVENT_CATEGORY_OPTIONS.find((opt) => opt.label === cat);
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 text-xs font-semibold text-teal-900 dark:text-teal-200 animate-fadeIn shadow-2xs"
              >
                <span>{found ? found.icon : "🏷️"}</span>
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={(e) => removeCategory(cat, e)}
                  className="ml-0.5 text-teal-600 dark:text-teal-400 hover:text-red-500 dark:hover:text-red-400 rounded-full p-0.5 cursor-pointer transition-colors"
                  title={`Remove ${cat}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown Toggle Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full bg-slate-50 dark:bg-[#2A2A2A] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-5 py-3.5 flex items-center justify-between text-sm text-slate-900 dark:text-white hover:border-teal-500/50 transition cursor-pointer shadow-xs focus:ring-2 focus:ring-teal-500/20"
        >
          <div className="flex items-center gap-2 truncate">
            <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
              {selectedCategories.length > 0
                ? selectedCategories.join(", ")
                : "Choose categories..."}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180 text-teal-500" : ""
            }`}
          />
        </button>

        {/* Options Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3 max-h-80 overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Click to select 1 or more categories:</span>
              <button
                type="button"
                onClick={() => onChange(["General Announcement"])}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer font-medium"
              >
                Reset to Default
              </button>
            </div>

            {/* Quick search input if > 8 options */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category options..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredOptions.map((opt) => {
                const isSelected = selectedCategories.includes(opt.label);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => toggleCategory(opt.label)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs font-medium transition text-left cursor-pointer ${
                      isSelected
                        ? "bg-teal-50 dark:bg-teal-950/70 border-teal-500 text-teal-900 dark:text-teal-100 shadow-xs ring-1 ring-teal-500/50"
                        : "bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {/* Radio / Check Circle Indicator */}
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                        isSelected
                          ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      }`}
                      title={isSelected ? "Selected" : "Click to select"}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-scaleIn" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
