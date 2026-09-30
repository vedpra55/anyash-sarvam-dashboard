/** Helpers for the working-memory text (parent_profiles.current_user_context). */

const HEADER_LINE = /^\s*(TODAY|LAST UPDATED):.*$/im;

/**
 * Makes the first line "LAST UPDATED: <date> | CALL COUNT: <n>", replacing an
 * old TODAY or LAST UPDATED line wherever it is.
 */
export function stampHeader(context: string, dateLabel: string, nextCallNumber: number): string {
  const header = `LAST UPDATED: ${dateLabel} | CALL COUNT: ${nextCallNumber}`;
  const body = context.replace(HEADER_LINE, "").replace(/^\s*\n/, "").trimEnd();
  return body ? `${header}\n${body}` : header;
}

/** First memory for a parent with none yet. */
export function initialMemory(parentName: string, childName: string): string {
  return `BASELINE: ${parentName} | Child: ${childName}\nPERSONAL: not shared yet\nACTIVE WATCHLIST:\n- none yet\nLIFE THREADS:\n- none`;
}

export function hasPersonalSection(context: string): boolean {
  return /^\s*PERSONAL:/im.test(context);
}
