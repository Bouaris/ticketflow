/**
 * App Version & Build Constants
 *
 * These values are injected at build time by Vite:
 * - APP_VERSION: from package.json version
 * - CHANGELOG_CONTENT: raw content of CHANGELOG.md
 */

declare const __APP_VERSION__: string;
declare const __CHANGELOG_CONTENT__: string;

export const APP_VERSION = __APP_VERSION__;
export const CHANGELOG_CONTENT = __CHANGELOG_CONTENT__;
