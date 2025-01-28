export interface StyleVariables {
  overlay?: Record<string, Record<string, string>>; // overlay id -> variable -> value
}

export type StyleVariableSpec = SelectStyleVariable;

export interface SelectStyleVariable {
  type: 'select';
  label: string;
  options: { name: string; value: string }[];
}
