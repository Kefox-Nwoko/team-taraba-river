import React from "react";
import { X, HelpCircle, Check, Ruler } from "lucide-react";

interface TShirtSizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
}

export const ASIAN_SIZES = [
  { size: "XS", chest: "CH 36", label: "36\" chest", usEquiv: "—" },
  { size: "S", chest: "CH 38", label: "38\" chest", usEquiv: "US XXS" },
  { size: "M", chest: "CH 40", label: "40\" chest", usEquiv: "US XS" },
  { size: "L", chest: "CH 42", label: "42\" chest", usEquiv: "US S" },
  { size: "XL", chest: "CH 44", label: "44\" chest", usEquiv: "US M" },
  { size: "XXL", chest: "CH 46", label: "46\" chest", usEquiv: "US L" },
  { size: "3XL", chest: "CH 48", label: "48\" chest", usEquiv: "US XL" },
  { size: "4XL", chest: "CH 50", label: "50\" chest", usEquiv: "US XXL" },
  { size: "5XL", chest: "CH 52", label: "52\" chest", usEquiv: "US 3XL" },
  { size: "6XL", chest: "CH 54", label: "54\" chest", usEquiv: "US 4XL" },
  { size: "7XL", chest: "CH 56", label: "56\" chest", usEquiv: "US 5XL" },
  { size: "8XL", chest: "CH 58", label: "58\" chest", usEquiv: "US 6XL" },
  { size: "9XL", chest: "CH 60", label: "60\" chest", usEquiv: "US 7XL" },
  { size: "10XL", chest: "CH 62", label: "62\" chest", usEquiv: "US 8XL" },
  { size: "11XL", chest: "CH 64", label: "64\" chest", usEquiv: "US 9XL" },
];

export const US_SIZES = [
  { size: "XXS", chest: "CH 38", label: "38\" chest", asianEquiv: "Asian S" },
  { size: "XS", chest: "CH 40", label: "40\" chest", asianEquiv: "Asian M" },
  { size: "S", chest: "CH 42", label: "42\" chest", asianEquiv: "Asian L" },
  { size: "M", chest: "CH 44", label: "44\" chest", asianEquiv: "Asian XL" },
  { size: "L", chest: "CH 46", label: "46\" chest", asianEquiv: "Asian XXL" },
  { size: "XL", chest: "CH 48", label: "48\" chest", asianEquiv: "Asian 3XL" },
  { size: "XXL", chest: "CH 50", label: "50\" chest", asianEquiv: "Asian 4XL" },
  { size: "3XL", chest: "CH 52", label: "52\" chest", asianEquiv: "Asian 5XL" },
  { size: "4XL", chest: "CH 54", label: "54\" chest", asianEquiv: "Asian 6XL" },
  { size: "5XL", chest: "CH 56", label: "56\" chest", asianEquiv: "Asian 7XL" },
  { size: "6XL", chest: "CH 58", label: "58\" chest", asianEquiv: "Asian 8XL" },
  { size: "7XL", chest: "CH 60", label: "60\" chest", asianEquiv: "Asian 9XL" },
  { size: "8XL", chest: "CH 62", label: "62\" chest", asianEquiv: "Asian 10XL" },
  { size: "9XL", chest: "CH 64", label: "64\" chest", asianEquiv: "Asian 11XL" },
];

export const TShirtSizeGuideModal: React.FC<TShirtSizeGuideModalProps> = ({
  isOpen,
  onClose,
  selectedSize,
  onSelectSize,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Jersey & T-Shirt Sizing Guide
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Asian (Nigerian Local Market) & American (US/UK) Size Equivalencies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* How to Measure Tip Box */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-500/20 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold text-teal-800 dark:text-teal-300">
            <HelpCircle className="w-4 h-4 text-teal-600 shrink-0" />
            <span>How to Find Your Exact Size:</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
            <strong>Not sure of your size?</strong> Lay a shirt that fits you well flat on a table, measure
            from <strong>armpit to armpit in inches</strong>, and <strong>double it</strong> — that number is your <strong>CH (chest) size</strong> shown below.
          </p>
          <div className="text-[11px] text-teal-700 dark:text-teal-400 bg-white/60 dark:bg-slate-950/60 p-2.5 rounded-xl border border-teal-500/20">
            <strong>Key Rule:</strong> American sizes run <strong>two steps bigger</strong> than Asian sizes. For example: <strong>Asian XL = American M = CH 44" Chest</strong>.
          </div>
        </div>

        {/* Asian Size Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
              <span>🇳🇬 Asian Sizing (Nigerian Local Markets)</span>
            </h3>
            <span className="text-[11px] text-slate-500">Standard for locally-bought clothes</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ASIAN_SIZES.map((item) => {
              const fullVal = `Asian ${item.size} (${item.usEquiv !== "—" ? item.usEquiv + " / " : ""}${item.chest})`;
              const isSelected = selectedSize?.includes(`Asian ${item.size}`);
              return (
                <button
                  type="button"
                  key={item.size}
                  onClick={() => {
                    if (onSelectSize) onSelectSize(fullVal);
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? "bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-400"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/30"
                  }`}
                >
                  <span className="text-xs font-bold">{item.size}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.chest}</span>
                  <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium">{item.usEquiv}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* American Size Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <span>🇺🇸 American / UK Sizing</span>
            </h3>
            <span className="text-[11px] text-slate-500">For US/UK imported brands</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {US_SIZES.map((item) => {
              const fullVal = `US ${item.size} (${item.asianEquiv} / ${item.chest})`;
              const isSelected = selectedSize?.includes(`US ${item.size}`);
              return (
                <button
                  type="button"
                  key={item.size}
                  onClick={() => {
                    if (onSelectSize) onSelectSize(fullVal);
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? "bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/30"
                  }`}
                >
                  <span className="text-xs font-bold">{item.size}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.chest}</span>
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">{item.asianEquiv}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
