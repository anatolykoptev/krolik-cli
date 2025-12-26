/**
 * @module lib/@docs-cache
 * @description Documentation cache module - SQLite-based cache for Context7 documentation
 *
 * This module provides:
 * - Dynamic library resolution with Context7 API fallback (registry)
 * - Library detection from package.json with monorepo support (detector)
 * - Documentation fetching and caching (fetcher)
 * - SQLite storage with FTS5 search (storage)
 * - HTTP client for Context7 API (context7-client)
 */

export * from './context7-client';
export * from './detector';
export * from './fetcher';
export * from './registry';
export * from './storage';
export * from './types';
