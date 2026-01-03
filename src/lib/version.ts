/**
 * App Version - Centralized version constant
 *
 * The version is injected at build time by Vite from package.json.
 * This ensures the displayed version always matches the package version.
 */

declare const __APP_VERSION__: string;

export const APP_VERSION = __APP_VERSION__;
