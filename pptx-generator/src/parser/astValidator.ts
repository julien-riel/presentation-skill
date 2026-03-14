import { PresentationSchema, type Presentation } from '../schema/presentation.js';

type ValidateSuccess = { success: true; data: Presentation };
type ValidateFailure = { success: false; errors: string[] };
type ValidateResult = ValidateSuccess | ValidateFailure;

/**
 * Validates input (object or JSON string) against the Presentation AST schema.
 * Returns typed success with parsed data, or failure with human-readable errors.
 */
export function validateAST(input: unknown): ValidateResult {
  let data: unknown = input;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { success: false, errors: ['Invalid JSON: could not parse input string'] };
    }
  }

  const result = PresentationSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}
