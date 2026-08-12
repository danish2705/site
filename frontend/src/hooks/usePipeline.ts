import { useContext } from "react";
import {
  PipelineContext,
  type PipelineState,
} from "../context/PipelineContext";

export function usePipeline(): PipelineState {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error("usePipeline() must be used within a PipelineProvider");
  }
  return ctx;
}
