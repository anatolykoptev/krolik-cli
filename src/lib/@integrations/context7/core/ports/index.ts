/**
 * @module lib/@integrations/context7/core/ports
 * @description Port interfaces for dependency inversion
 *
 * These interfaces define contracts between the domain layer
 * and infrastructure implementations. Following the Ports & Adapters
 * (Hexagonal) architecture pattern.
 */

export type {
  DocsResponse,
  IDocumentFetcher,
  IResilientFetcher,
  ResilientFetcherConfig,
} from './document-fetcher.interface';
export type { ILibraryRepository } from './library-repository.interface';
export type {
  ILibraryResolver,
  IResolverChain,
  ITopicProvider,
} from './library-resolver.interface';
