// Ligne d'une note de version rendue en Markdown en ligne [D226].
import { parseInline } from "./markdown.ts";

export function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        switch (part.type) {
          case "strong":
            return <strong key={index}>{part.text}</strong>;
          case "em":
            return <em key={index}>{part.text}</em>;
          case "code":
            return (
              <code key={index} className="rounded-sm bg-surface px-1 font-mono text-sm">
                {part.text}
              </code>
            );
          case "link":
            return (
              <a
                key={index}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline"
              >
                {part.text}
              </a>
            );
          default:
            return part.text;
        }
      })}
    </>
  );
}
