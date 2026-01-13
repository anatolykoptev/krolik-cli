/**
 * Type declarations for @xenova/transformers
 */
declare module '@xenova/transformers' {
  export interface PipelineOptions {
    cache_dir?: string;
    quantized?: boolean;
    progress_callback?: (progress: { status: string; progress?: number }) => void;
  }

  export interface FeatureExtractionOptions {
    pooling?: 'mean' | 'cls' | 'none';
    normalize?: boolean;
  }

  export interface FeatureExtractionOutput {
    data: Float32Array;
    dims: number[];
  }

  export type FeatureExtractionPipeline = (
    text: string,
    options?: FeatureExtractionOptions,
  ) => Promise<FeatureExtractionOutput>;

  export function pipeline(
    task: 'feature-extraction',
    model: string,
    options?: PipelineOptions,
  ): Promise<FeatureExtractionPipeline>;

  export function pipeline(
    task: string,
    model: string,
    options?: PipelineOptions,
  ): Promise<unknown>;
}
