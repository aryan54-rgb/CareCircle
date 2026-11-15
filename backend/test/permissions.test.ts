import { describe, it, expect } from 'vitest';
import { canPerform, assertPermission } from '../src/domain/permissions.js';

describe('Permissions Matrix (Section 6.6)', () => {
  it('ELDER permissions', () => {
    expect(canPerform('ELDER', 'VIEW_RECORDS')).toBe(true);
    expect(canPerform('ELDER', 'MARK_DOSE')).toBe(true);
    expect(canPerform('ELDER', 'MANAGE_MEDS')).toBe(true);
    expect(canPerform('ELDER', 'MANAGE_APPOINTMENTS')).toBe(true);
    expect(canPerform('ELDER', 'SUBMIT_SUGGESTION')).toBe(true);
    expect(canPerform('ELDER', 'DECIDE_SUGGESTION')).toBe(true); // primary approver
    expect(canPerform('ELDER', 'MANAGE_CIRCLE')).toBe(false); // cannot create invites or change settings
    expect(canPerform('ELDER', 'RECEIVE_ESCALATIONS')).toBe(false);
  });

  it('CARETAKER permissions', () => {
    expect(canPerform('CARETAKER', 'VIEW_RECORDS')).toBe(true);
    expect(canPerform('CARETAKER', 'MARK_DOSE')).toBe(true); // on behalf
    expect(canPerform('CARETAKER', 'MANAGE_MEDS')).toBe(true);
    expect(canPerform('CARETAKER', 'MANAGE_APPOINTMENTS')).toBe(true);
    expect(canPerform('CARETAKER', 'SUBMIT_SUGGESTION')).toBe(true);
    expect(canPerform('CARETAKER', 'DECIDE_SUGGESTION')).toBe(true);
    expect(canPerform('CARETAKER', 'MANAGE_CIRCLE')).toBe(true); // owner
    expect(canPerform('CARETAKER', 'RECEIVE_ESCALATIONS')).toBe(true);
  });

  it('FAMILY permissions', () => {
    expect(canPerform('FAMILY', 'VIEW_RECORDS')).toBe(true);
    expect(canPerform('FAMILY', 'MARK_DOSE')).toBe(false); // cannot mark dose
    expect(canPerform('FAMILY', 'MANAGE_MEDS')).toBe(false); // cannot add/edit meds directly
    expect(canPerform('FAMILY', 'MANAGE_APPOINTMENTS')).toBe(false);
    expect(canPerform('FAMILY', 'SUBMIT_SUGGESTION')).toBe(true); // can submit suggestion
    expect(canPerform('FAMILY', 'DECIDE_SUGGESTION')).toBe(false); // cannot approve
    expect(canPerform('FAMILY', 'MANAGE_CIRCLE')).toBe(false);
    expect(canPerform('FAMILY', 'RECEIVE_ESCALATIONS')).toBe(true); // level 2 & digest
  });

  it('assertPermission throws when unauthorized', () => {
    expect(() => assertPermission('FAMILY', 'MARK_DOSE')).toThrow(
      "Role 'FAMILY' is not authorized to perform 'MARK_DOSE'"
    );
    expect(() => assertPermission('ELDER', 'MANAGE_CIRCLE')).toThrow(
      "Role 'ELDER' is not authorized to perform 'MANAGE_CIRCLE'"
    );
    expect(() => assertPermission('CARETAKER', 'VIEW_RECORDS')).not.toThrow();
  });
});
