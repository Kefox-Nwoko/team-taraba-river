import React from "react";
import { ArrowLeft } from "lucide-react";

interface ReturnButtonProps {
  onClick: () => void;
  className?: string;
}

export const ReturnButton: React.FC<ReturnButtonProps> = ({ onClick, className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition flex items-center justify-center cursor-pointer shadow-sm shrink-0 ${className}`}
      title="Return"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
};
