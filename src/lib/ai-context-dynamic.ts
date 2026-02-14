/**
 * AI Dynamic Context Pipeline
 *
 * Assembles contextual information for AI prompts including:
 * - Project metadata (types, modules, terminology)
 * - Few-shot examples from similar tickets
 * - Module context from related items
 *
 * @module lib/ai-context-dynamic
 */

import type { BacklogItem } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';
import {
  selectFewShotExamples,
  selectFewShotExamplesWithFeedback,
  formatExampleForPrompt,
  extractTerminology,
  type FewShotOptions,
} from './ai-few-shot';

// ============================================================
// TYPES
// ============================================================

export interface ProjectMetadata {
  /** Available item types with their labels */
  types: Array<{ id: string; label: string }>;
  /** Unique modules/components found in existing items */
  modules: string[];
  /** Common terminology extracted from item titles */
  terminology: string[];
}

export interface DynamicContext {
  /** Project-level metadata */
  projectMetadata: ProjectMetadata;
  /** Similar tickets selected as few-shot examples */
  fewShotExamples: BacklogItem[];
  /** Items from the same module (for module context) */
  moduleContext: BacklogItem[];
}

export interface ContextOptions {
  /** User's request or description */
  query: string;
  /** All items in the project */
  items: BacklogItem[];
  /** Type configurations for the project */
  typeConfigs: TypeDefinition[];
  /** Type being created (for few-shot preference) */
  targetType?: string;
  /** Module being targeted (for module context) */
  targetModule?: string;
  /** Number of few-shot examples to include (default: 3) */
  fewShotCount?: number;
  /** Number of module context items to include (default: 5) */
  moduleContextCount?: number;
  /** Feedback scores map for biased few-shot selection (itemId -> rating) */
  feedbackScores?: Map<string, number>;
}

// ============================================================
// PROJECT METADATA EXTRACTION
// ============================================================

/**
 * Extract project metadata from items and type configurations.
 *
 * @param items - All items in the project
 * @param typeConfigs - Type definitions
 * @returns ProjectMetadata with types, modules, and terminology
 */
export function extractProjectMetadata(
  items: BacklogItem[],
  typeConfigs: TypeDefinition[]
): ProjectMetadata {
  // Map type configs to simplified format
  const types = typeConfigs.map(t => ({
    id: t.id,
    label: t.label,
  }));

  // Extract unique modules/components
  const modulesSet = new Set<string>();
  for (const item of items) {
    if (item.module) {
      modulesSet.add(item.module);
    }
    if (item.component && !item.module) {
      // Only add component if module is not set (avoid duplicates)
      modulesSet.add(item.component);
    }
  }
  const modules = [...modulesSet].sort();

  // Extract common terminology from titles
  const terminology = extractTerminology(items, 10);

  return {
    types,
    modules,
    terminology,
  };
}

// ============================================================
// CONTEXT GATHERING
// ============================================================

/**
 * Gather dynamic context for AI prompt enhancement.
 *
 * @param options - Context gathering options
 * @returns DynamicContext with metadata, few-shot examples, and module context
 */
export async function gatherDynamicContext(
  options: ContextOptions
): Promise<DynamicContext> {
  const {
    query,
    items,
    typeConfigs,
    targetType,
    targetModule,
    fewShotCount = 3,
    moduleContextCount = 5,
    feedbackScores,
  } = options;

  // Extract project metadata
  const projectMetadata = extractProjectMetadata(items, typeConfigs);

  // Select few-shot examples based on query similarity
  // Use feedback-biased selection when scores are available
  const fewShotOptions: FewShotOptions = {
    query,
    candidates: items,
    count: fewShotCount,
    preferType: targetType,
    preferModule: targetModule,
  };

  let fewShotExamples: BacklogItem[];
  if (feedbackScores && feedbackScores.size > 0) {
    fewShotExamples = selectFewShotExamplesWithFeedback({
      ...fewShotOptions,
      feedbackScores,
    });
  } else {
    fewShotExamples = selectFewShotExamples(fewShotOptions);
  }

  // Gather module context (items from same module)
  let moduleContext: BacklogItem[] = [];
  if (targetModule) {
    const normalizedTarget = targetModule.toLowerCase();

    // Filter items to those in the same module
    const moduleItems = items.filter(item => {
      const itemModule = (item.module || item.component || '').toLowerCase();
      return itemModule.includes(normalizedTarget) ||
             normalizedTarget.includes(itemModule);
    });

    // Sort by recency (most recent first) - use sectionIndex as proxy for recency
    moduleItems.sort((a, b) => b.sectionIndex - a.sectionIndex);

    // Exclude items already in few-shot examples to avoid duplication
    const fewShotIds = new Set(fewShotExamples.map(e => e.id));
    const uniqueModuleItems = moduleItems.filter(item => !fewShotIds.has(item.id));

    // Take top N
    moduleContext = uniqueModuleItems.slice(0, moduleContextCount);
  }

  return {
    projectMetadata,
    fewShotExamples,
    moduleContext,
  };
}

// ============================================================
// PROMPT BUILDING
// ============================================================

/**
 * Build an enhanced prompt by injecting dynamic context.
 *
 * @param basePrompt - Original prompt
 * @param context - Dynamic context to inject
 * @returns Enhanced prompt with context sections
 */
export function buildEnhancedPrompt(
  basePrompt: string,
  context: DynamicContext
): string {
  const sections: string[] = [];

  // PROJECT CONTEXT section
  sections.push('## PROJECT CONTEXT');

  // Types
  const typesList = context.projectMetadata.types
    .map(t => t.id)
    .join(', ');
  sections.push(`Available types: ${typesList || 'None defined'}`);

  // Modules
  const modulesList = context.projectMetadata.modules.join(', ');
  sections.push(`Known modules: ${modulesList || 'None detected'}`);

  // Terminology
  const terminologyList = context.projectMetadata.terminology.join(', ');
  if (terminologyList) {
    sections.push(`Project terminology: ${terminologyList}`);
  }

  sections.push(''); // Empty line separator

  // EXAMPLE TICKETS section
  if (context.fewShotExamples.length > 0) {
    sections.push('## EXAMPLE TICKETS FROM THIS PROJECT');
    sections.push('Use these as reference for style and structure:');
    sections.push('');

    for (const example of context.fewShotExamples) {
      sections.push('```');
      sections.push(formatExampleForPrompt(example));
      sections.push('```');
      sections.push('');
    }
  }

  // MODULE CONTEXT section
  if (context.moduleContext.length > 0) {
    sections.push('## RELATED ITEMS IN SAME MODULE');
    sections.push('These items are in the same module for context:');
    sections.push('');

    for (const item of context.moduleContext) {
      const moduleInfo = item.module || item.component || '';
      sections.push(`- ${item.id}: ${item.title}${moduleInfo ? ` [${moduleInfo}]` : ''}`);
    }

    sections.push('');
  }

  // Separator before user request
  sections.push('---');
  sections.push('');

  // Combine context with base prompt
  return sections.join('\n') + basePrompt;
}

// ============================================================
// CONVENIENCE FUNCTION
// ============================================================

/**
 * One-shot function to gather context and build enhanced prompt.
 *
 * @param basePrompt - Original prompt
 * @param options - Context options
 * @returns Enhanced prompt with all context injected
 */
export async function buildPromptWithDynamicContext(
  basePrompt: string,
  options: ContextOptions
): Promise<string> {
  const context = await gatherDynamicContext(options);
  return buildEnhancedPrompt(basePrompt, context);
}
