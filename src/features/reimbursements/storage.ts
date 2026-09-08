import { supabase } from '../../lib/supabase';

const BUCKET = 'reimbursement-evidence';

export async function uploadEvidence(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function evidenceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export function procurementEvidencePath(caseId: string, fileName: string): string {
  return `procurement/${caseId}/${Date.now()}-${fileName}`;
}

export function apBillEvidencePath(batchId: string, billKey: string, fileName: string): string {
  return `ap-bills/${batchId}/${billKey}/${Date.now()}-${fileName}`;
}
