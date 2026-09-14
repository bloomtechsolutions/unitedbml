import { supabase } from '../../lib/supabase';

const BUCKET = 'event-report-photos';
const MAX_SIZE = 10485760; // 10 MB, matching the Storage bucket's own limit

export async function uploadReportPhoto(reportId: string, file: File): Promise<{ path: string }> {
  if (file.size > MAX_SIZE) throw new Error('Photo exceeds the 10 MB limit.');
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${reportId}/${Date.now()}-${sanitized}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return { path };
}

export async function removeReportPhoto(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function reportPhotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 900);
  if (error) return null;
  return data.signedUrl;
}

export async function reportPhotoAsDataUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${data.type || 'image/jpeg'};base64,${btoa(binary)}`;
}
