import { Role } from '../lib/validate.js';

export type Action =
  | 'VIEW_RECORDS'
  | 'MARK_DOSE'
  | 'MANAGE_MEDS'
  | 'MANAGE_APPOINTMENTS'
  | 'SUBMIT_SUGGESTION'
  | 'DECIDE_SUGGESTION'
  | 'MANAGE_CIRCLE' // invites, settings
  | 'RECEIVE_ESCALATIONS';

export const PERMISSIONS_MATRIX: Record<Role, Record<Action, boolean>> = {
  ELDER: {
    VIEW_RECORDS: true,
    MARK_DOSE: true,
    MANAGE_MEDS: true,
    MANAGE_APPOINTMENTS: true,
    SUBMIT_SUGGESTION: true,
    DECIDE_SUGGESTION: true, // primary approver
    MANAGE_CIRCLE: false,
    RECEIVE_ESCALATIONS: false,
  },
  CARETAKER: {
    VIEW_RECORDS: true,
    MARK_DOSE: true, // on behalf, logged
    MANAGE_MEDS: true,
    MANAGE_APPOINTMENTS: true,
    SUBMIT_SUGGESTION: true,
    DECIDE_SUGGESTION: true,
    MANAGE_CIRCLE: true, // owner
    RECEIVE_ESCALATIONS: true,
  },
  FAMILY: {
    VIEW_RECORDS: true,
    MARK_DOSE: false,
    MANAGE_MEDS: false,
    MANAGE_APPOINTMENTS: false,
    SUBMIT_SUGGESTION: true,
    DECIDE_SUGGESTION: false,
    MANAGE_CIRCLE: false,
    RECEIVE_ESCALATIONS: true, // level 2 and weekly digest
  },
};

export function canPerform(role: Role, action: Action): boolean {
  return !!PERMISSIONS_MATRIX[role]?.[action];
}

export function assertPermission(role: Role, action: Action): void {
  if (!canPerform(role, action)) {
    throw new Error(`Role '${role}' is not authorized to perform '${action}'`);
  }
}
