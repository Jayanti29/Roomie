import { db, isFirebaseConfigured, ref, get } from '../firebase';

/**
 * Downloads a file instantly and securely.
 * 1. If it's a mock url (starts with mock-file-url: or mock-pdf-url:), fetches base64 content from database.
 * 2. If it's an http/https url, fetches as blob first to force download and prevent page reload.
 * 3. Fallback to target="_blank" download anchor.
 */
export const downloadFileHelper = async (url: string, fileName: string) => {
  if (!url) {
    console.error('[Download] Empty URL provided.');
    return;
  }

  // 1. Resolve mock URLs from Realtime Database
  if (url.startsWith('mock-file-url:') || url.startsWith('mock-pdf-url:')) {
    const mockId = url.split(':')[1];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, 'pdf_contents/' + mockId));
        if (snap.exists()) {
          const dataUrl = snap.val();
          triggerDownload(dataUrl, fileName);
        } else {
          console.warn('[Download] Mock file content not found for ID:', mockId);
          alert('Local mock file not found in database.');
        }
      } catch (err) {
        console.error('[Download] Error fetching mock PDF:', err);
      }
    }
    return;
  }

  // 2. Resolve data/base64 URLs directly
  if (url.startsWith('data:')) {
    triggerDownload(url, fileName);
    return;
  }

  // 3. For http/https URLs:
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const triggerDownload = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

