import { supabase } from '../../lib/supabase';

const BUCKET = 'unitedbml-documents';
const MAX_SIZE = 26214400; // 25 MB, matching the Storage bucket's own limit

export async function uploadDocumentFile(eventId: string | null, file: File): Promise<{ path: string }> {
  if (file.size > MAX_SIZE) throw new Error('File exceeds the 25 MB limit.');
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${eventId || 'general'}/${Date.now()}-${sanitized}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return { path };
}

export async function removeDocumentFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function documentSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 900);
  if (error) return null;
  return data.signedUrl;
}
