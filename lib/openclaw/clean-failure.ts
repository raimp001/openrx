// Single source of truth for collapsing upstream model failures into one
// clean patient-facing message. Any response that contains a model-failure
// note must be replaced wholesale — never an error note stacked on top of a
// fallback template (regression guard for the double-failure-mode bug).
export const CLEAN_BUSY_MESSAGE = "We're busy right now. Please try again in a moment."

export function isModelFailureText(text: string): boolean {
  return /Our AI assistant is handling a high volume|temporarily at capacity|rate_limit|overloaded|Our AI service experienced a temporary issue|Our AI service needs a configuration update|The request took longer than expected|Something went wrong while processing your request/i.test(text)
}
