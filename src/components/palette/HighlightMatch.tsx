/**
 * HighlightMatch - Highlights matched search terms within text
 *
 * Uses regex-based splitting to wrap matched terms in styled <mark> elements.
 * Terms are sorted by length descending to avoid partial match conflicts.
 */

interface HighlightMatchProps {
  text: string;
  terms: string[]; // Matched terms from MiniSearch (already lowercased)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightMatch({ text, terms }: HighlightMatchProps) {
  if (terms.length === 0) {
    return <>{text}</>;
  }

  // Sort by length descending so longest terms match first
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(escapeRegex).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const parts = text.split(regex);
  // Use a non-global regex for testing to avoid lastIndex state issues
  const testRegex = new RegExp(`^(?:${pattern})$`, 'i');

  return (
    <>
      {parts.map((part, index) =>
        part && testRegex.test(part) ? (
          <mark
            key={index}
            className="bg-accent-soft text-accent-text font-semibold rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
