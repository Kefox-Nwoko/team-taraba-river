import React from "react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Parses inline markdown tokens (bold, italics, code, links) into React nodes.
 */
function renderInlineMarkdown(text: string, isUser: boolean = false): React.ReactNode[] {
  // Regex to match:
  // 1. ***bold italic***
  // 2. **bold** or __bold__
  // 3. *italic* or _italic_
  // 4. `code`
  // 5. [text](url)
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold + Italic (***text***)
    if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
      const inner = part.slice(3, -3);
      return (
        <strong key={index} className={`font-bold italic ${isUser ? "text-white" : "text-slate-900 dark:text-white"}`}>
          {inner}
        </strong>
      );
    }

    // Bold (**text** or __text__)
    if ((part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length > 4)) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className={`font-bold ${isUser ? "text-white font-extrabold" : "text-slate-900 dark:text-white font-bold"}`}>
          {inner}
        </strong>
      );
    }

    // Italic (*text* or _text_)
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {inner}
        </em>
      );
    }

    // Inline Code (`code`)
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`px-1.5 py-0.5 rounded text-xs font-mono ${
            isUser
              ? "bg-teal-800 text-teal-100"
              : "bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/40"
          }`}
        >
          {inner}
        </code>
      );
    }

    // Markdown Link ([text](url))
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, linkText, linkUrl] = linkMatch;
      return (
        <a
          key={index}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium hover:opacity-80 transition ${
            isUser ? "text-white underline" : "text-teal-600 dark:text-teal-400"
          }`}
        >
          {linkText}
        </a>
      );
    }

    // Plain text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Parses multi-line markdown content into structured React elements with headings, lists, and paragraphs.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = "",
  isUser = false,
}) => {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let currentListItems: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = (keyPrefix: number) => {
    if (currentListItems.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`ol-${keyPrefix}`} className="list-decimal pl-5 space-y-1.5 my-2">
            {currentListItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="space-y-1.5 my-2 pl-1">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
      isNumberedList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      flushList(index);
      return;
    }

    // Bullet List item (* item, - item, • item, + item)
    const bulletMatch = trimmed.match(/^([*\-•+])\s+(.+)$/);
    if (bulletMatch) {
      if (isNumberedList) {
        flushList(index);
      }
      const itemText = bulletMatch[2];
      currentListItems.push(
        <li key={`li-${index}`} className="flex items-start gap-2 text-inherit">
          <span className={`select-none mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
            isUser ? "bg-white/80" : "bg-amber-500 dark:bg-amber-400"
          }`} />
          <div className="flex-1 leading-relaxed">
            {renderInlineMarkdown(itemText, isUser)}
          </div>
        </li>
      );
      return;
    }

    // Numbered List item (1. item, 2. item)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (!isNumberedList && currentListItems.length > 0) {
        flushList(index);
      }
      isNumberedList = true;
      const num = numMatch[1];
      const itemText = numMatch[2];
      currentListItems.push(
        <li key={`li-${index}`} className="flex items-start gap-2 text-inherit">
          <span className={`select-none font-bold text-xs shrink-0 min-w-4 text-right ${
            isUser ? "text-teal-200" : "text-amber-600 dark:text-amber-400"
          }`}>
            {num}.
          </span>
          <div className="flex-1 leading-relaxed">
            {renderInlineMarkdown(itemText, isUser)}
          </div>
        </li>
      );
      return;
    }

    // If we reach here, it's not a list item: flush any pending list
    flushList(index);

    // Headings (###, ##, #)
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h4-${index}`} className={`font-bold text-sm sm:text-base mt-3 mb-1 ${
          isUser ? "text-white" : "text-slate-900 dark:text-white"
        }`}>
          {renderInlineMarkdown(trimmed.slice(4), isUser)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={`h3-${index}`} className={`font-extrabold text-base sm:text-lg mt-3.5 mb-1.5 ${
          isUser ? "text-white" : "text-slate-900 dark:text-white"
        }`}>
          {renderInlineMarkdown(trimmed.slice(3), isUser)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={`h2-${index}`} className={`font-black text-lg sm:text-xl mt-4 mb-2 ${
          isUser ? "text-white" : "text-slate-900 dark:text-white"
        }`}>
          {renderInlineMarkdown(trimmed.slice(2), isUser)}
        </h2>
      );
      return;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${index}`} className="leading-relaxed my-1">
        {renderInlineMarkdown(trimmed, isUser)}
      </p>
    );
  });

  // Flush any remaining list at the end
  flushList(lines.length);

  return <div className={`space-y-1.5 ${className}`}>{elements}</div>;
};
