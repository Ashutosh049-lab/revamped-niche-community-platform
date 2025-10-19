import { useState } from "react";
import { storage } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "../../components/ToastProvider";

export interface MediaItem { url: string; type: 'image' | 'gif' | 'video' }

export default function MediaUploader({ onAdd }: { onAdd: (items: MediaItem[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploading(true);
      setError(null);
      if (!storage) throw new Error("Firebase storage not configured");
      const uploaded: MediaItem[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const type: MediaItem['type'] = file.type.startsWith('video') ? 'video' : (ext === 'gif' ? 'gif' : 'image');
        const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        uploaded.push({ url, type });
      }
      onAdd(uploaded);
      if (uploaded.length > 0) showToast(`Uploaded ${uploaded.length} file(s)`, 'success');
    } catch (e: any) {
      setError(e.message);
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <input type="file" multiple accept="image/*,video/*" onChange={(e) => onFiles(e.target.files)} />
      {uploading && <div className="text-sm text-gray-600">Uploading...</div>}
    </div>
  );
}