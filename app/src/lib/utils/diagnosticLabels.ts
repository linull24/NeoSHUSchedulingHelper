import type { TranslateFn } from "$lib/i18n";

export type DiagnosticCode =
  | "conflic"
  | "impossible"
  | "weak-impossible"
  | "time-conflict"
  | "hard-conflict";

export function formatConflictLabel(label: string | undefined, t: TranslateFn): string {
  if (!label) return "";
  switch (label) {
    case "conflic":
    case "time-conflict":
      return t("panels.common.conflictTime");
    case "hard-conflict":
      return t("panels.common.conflictHard");
    case "impossible":
      return t("panels.solver.diagnosticUnadjustable");
    case "weak-impossible":
      return t("panels.solver.diagnosticSoft");
    default:
      return label;
  }
}
