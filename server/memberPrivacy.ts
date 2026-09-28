import { Member } from '../src/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Month + day of a member's birthday as "October 12" — never the year.
 * Handles the three shapes stored in the roster: ISO "1990-10-12", free-text
 * "October 12" / "12th of October", and separate birthMonth/birthDay fields.
 * Returns '' if no birthday can be worked out.
 */
export function birthdayLabel(m: Partial<Member> & { birthMonth?: string; birthDay?: string }): string {
  let month = 0;
  let day = 0;

  const dob = (m.dateOfBirth || '').trim();
  const iso = dob.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    month = parseInt(iso[1], 10);
    day = parseInt(iso[2], 10);
  } else if (dob) {
    const lower = dob.replace(/(\d+)(st|nd|rd|th)/gi, '$1').toLowerCase();
    const idx = MONTH_NAMES.findIndex((n) => lower.includes(n.toLowerCase().slice(0, 3)));
    if (idx !== -1) {
      month = idx + 1;
      const d = lower.match(/\b([0-2]?[0-9]|3[01])\b/);
      if (d) day = parseInt(d[1], 10);
    }
  }

  if (!month && m.birthMonth) {
    const lower = String(m.birthMonth).toLowerCase();
    const idx = MONTH_NAMES.findIndex((n) => lower.includes(n.toLowerCase().slice(0, 3)));
    month = idx !== -1 ? idx + 1 : parseInt(lower, 10) || 0;
  }
  if (!day && m.birthDay) day = parseInt(String(m.birthDay), 10) || 0;

  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/**
 * What one member is allowed to see of another member outside the business-
 * opportunity search: name, photo and birthday (month + day) only — enough for
 * the birthday calendar and the member count. No contact details, address,
 * school, next of kin, points or year of birth.
 */
export function toCommunityView(m: Member): Member {
  return {
    id: m.id,
    fullName: m.fullName,
    title: m.title,
    firstName: m.firstName,
    surname: m.surname,
    photoUrl: m.photoUrl || '',
    photoStatus: m.photoStatus,
    dateOfBirth: birthdayLabel(m),
    email: '',
    phoneNumber: '',
    occupation: '',
    skills: [],
    role: 'member',
    activityPoints: 0,
    joinedAt: '',
    lastActive: '',
  };
}
