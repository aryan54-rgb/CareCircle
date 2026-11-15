export const Keys = {
  circleMeta(circleId: string) {
    return { PK: `C#${circleId}`, SK: 'META' };
  },
  member(circleId: string, memberId: string) {
    return { PK: `C#${circleId}`, SK: `M#${memberId}` };
  },
  loginLookup(email: string) {
    return { PK: `U#${email.toLowerCase().trim()}`, SK: 'LOGIN' };
  },
  invite(code: string) {
    return { PK: `INV#${code.toUpperCase().trim()}`, SK: 'META' };
  },
  medication(circleId: string, medId: string) {
    return { PK: `C#${circleId}`, SK: `MED#${medId}` };
  },
  dose(circleId: string, dueAtISO: string, medId: string) {
    return { PK: `C#${circleId}`, SK: `D#${dueAtISO}#${medId}` };
  },
  appointment(circleId: string, startsAtISO: string, apptId: string) {
    return { PK: `C#${circleId}`, SK: `A#${startsAtISO}#${apptId}` };
  },
  suggestion(circleId: string, createdAtISO: string, id: string) {
    return { PK: `C#${circleId}`, SK: `S#${createdAtISO}#${id}` };
  },
  activity(circleId: string, createdAtISO: string, id: string) {
    return { PK: `C#${circleId}`, SK: `L#${createdAtISO}#${id}` };
  },
  loginAttempts(email: string) {
    return { PK: `U#${email.toLowerCase().trim()}`, SK: 'ATTEMPTS' };
  },
};
