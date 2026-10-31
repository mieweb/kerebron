/**
 * Per-language code templates for typed get/set/listVars.
 * Jupyter has no standard variable RPC — each language injects its own snippets.
 */
export type KernelLanguageBridge = {
  /** Display id for errors. */
  id: string;
  /** language_info.name / kernelspec.language values (lowercase). */
  languages: string[];
  /** kernelspec name prefixes when language is empty/unknown. */
  namePrefixes?: string[];
  /** Client must track set() names (e.g. Deno cell const/let not enumerable). */
  trackSets: boolean;
  listVarsCode(marker: string): string;
  getCode(name: string, marker: string): string;
  setCode(name: string, jsonLiteral: string): string;
  filterNames?(names: string[]): string[];
};
