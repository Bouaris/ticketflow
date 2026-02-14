/**
 * ChatMessage - Individual message bubble component
 *
 * Renders user messages right-aligned with accent background,
 * and assistant messages left-aligned with surface background.
 * Detects item ID patterns in content and renders them as clickable citations.
 *
 * @module components/chat/ChatMessage
 */

import { type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';
import type { BacklogItem } from '../../types/backlog';
import { ItemCitation } from './ItemCitation';

// ============================================================
// TYPES
// ============================================================

interface ChatMessageProps {
  message: ChatMessageType;
  items: BacklogItem[];
  onOpenItem: (item: BacklogItem) => void;
}

// ============================================================
// HELPERS
// ============================================================

const ITEM_ID_PATTERN = /([A-Z]+-\d+)/g;

/**
 * Render message content with inline ItemCitation components for item IDs.
 * Combines IDs found via regex pattern and the citations array.
 */
function renderContentWithCitations(
  content: string,
  citations: string[],
  items: BacklogItem[],
  onOpenItem: (item: BacklogItem) => void
): ReactNode[] {
  // Build a set of all item IDs to highlight (from citations + pattern matches)
  const citationSet = new Set(citations);

  // Split content at item ID boundaries
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Use a non-global regex for the split approach
  const regex = new RegExp(ITEM_ID_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const itemId = match[1];
    const matchStart = match.index;

    // Add text before match
    if (matchStart > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>{content.slice(lastIndex, matchStart)}</span>
      );
    }

    // Check if this ID is in citations or exists in items
    const isKnownItem = citationSet.has(itemId) || items.some(i => i.id === itemId);

    if (isKnownItem) {
      parts.push(
        <ItemCitation
          key={`cite-${key++}`}
          itemId={itemId}
          items={items}
          onOpenItem={onOpenItem}
        />
      );
    } else {
      parts.push(
        <span key={`id-${key++}`} className="font-mono text-xs">{itemId}</span>
      );
    }

    lastIndex = matchStart + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${key++}`}>{content.slice(lastIndex)}</span>
    );
  }

  return parts.length > 0 ? parts : [<span key="full">{content}</span>];
}

// ============================================================
// COMPONENT
// ============================================================

export function ChatMessage({ message, items, onOpenItem }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-accent text-on-accent rounded-br-sm'
            : 'bg-surface-alt text-on-surface rounded-bl-sm'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {isUser
            ? message.content
            : renderContentWithCitations(
                message.content,
                message.citations ?? [],
                items,
                onOpenItem
              )}
        </div>
        <div
          className={`text-[10px] mt-1 ${
            isUser ? 'text-on-accent/60' : 'text-on-surface-secondary'
          }`}
        >
          {timestamp}
        </div>
      </div>
    </div>
  );
}
