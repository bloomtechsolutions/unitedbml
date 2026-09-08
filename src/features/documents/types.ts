export const DOCUMENT_CATEGORIES = ['EVENT', 'GENERAL', 'TOURNAMENT', 'MEETING'] as const;

export interface VirtualDocument {
  key: string;
  kind: 'MANUAL' | 'PROCUREMENT_EVIDENCE' | 'AP_BILLS_EVIDENCE';
  title: string;
  category: string;
  eventId: string | null;
  eventName: string | null;
  fileName: string;
  createdAt: string;
  uploadedByName: string | null;
  registryId: string | null;
  bucket: string | null;
  path: string | null;
}
