import { useContext } from "react";
import {
  PipelineContext,
  type PipelineState,
} from "../context/PipelineContext";

/**
 * Access the pipeline state. Throws rather than returning null so a
 * component rendered outside the provider fails loudly at the point of the
 * mistake instead of crashing later on an undefined field.
 */
export function usePipeline(): PipelineState {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error("usePipeline() must be used within a PipelineProvider");
  }
  return ctx;
}
