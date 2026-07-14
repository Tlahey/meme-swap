/**
 * Downloads a file by fetching it as a blob first, so the browser always
 * saves it under `filename` rather than navigating to `url` (which would
 * otherwise just be opened inline for media types like GIF/MP4).
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Failed to download file', err);
    window.open(url, '_blank');
  }
}
