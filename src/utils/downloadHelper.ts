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
    console.error('[DOWNLOAD FAILED] Empty URL');
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
          console.log('[DOWNLOAD SUCCESS]');
        } else {
          console.warn('[Download] Mock file content not found for ID:', mockId);
          console.error('[DOWNLOAD FAILED] Mock file not found in DB');
          alert('Local mock file not found in database.');
        }
      } catch (err) {
        console.error('[Download] Error fetching mock PDF:', err);
        console.error('[DOWNLOAD FAILED]', err);
      }
    }
    return;
  }

  // 2. Resolve data/base64 URLs directly
  if (url.startsWith('data:')) {
    try {
      triggerDownload(url, fileName);
      console.log('[DOWNLOAD SUCCESS]');
    } catch (err) {
      console.error('[DOWNLOAD FAILED]', err);
    }
    return;
  }

  // 3. For http/https URLs: fetch as a blob first to force download and prevent navigation
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    console.log('[DOWNLOAD SUCCESS]');
  } catch (err) {
    console.warn('[Download] Blob fetch failed, falling back to standard anchor download:', err);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[DOWNLOAD SUCCESS]');
    } catch (fallbackErr) {
      console.error('[DOWNLOAD FAILED]', fallbackErr);
    }
  }
};

const triggerDownload = (urlOrData: string, fileName: string) => {
  let finalUrl = urlOrData;
  let isBlob = false;
  if (urlOrData.startsWith('data:')) {
    try {
      const parts = urlOrData.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      finalUrl = URL.createObjectURL(blob);
      isBlob = true;
    } catch (e) {
      console.warn('Failed to convert data URL to blob, falling back to direct URL:', e);
    }
  }

  const link = document.createElement('a');
  link.href = finalUrl;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isBlob) {
    setTimeout(() => URL.revokeObjectURL(finalUrl), 5000);
  }
};

