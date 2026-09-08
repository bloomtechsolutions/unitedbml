export const AUDIENCE_CATEGORIES = ['MALE_BASED', 'ATOLL_BASED'] as const;
export const MATCH_TYPES = ['UNIT', 'DEPARTMENT'] as const;

export interface StaffImportRow {
  uid: string;
  name: string;
  jobTitle: string;
  division: string;
  department: string;
  unit: string;
}

export interface ClassificationRow {
  matchType: (typeof MATCH_TYPES)[number];
  value: string;
  category: string | null;
  notes: string | null;
  mappingId: string | null;
  count: number;
}
