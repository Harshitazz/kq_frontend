import { FileText, Link as LinkIcon } from "lucide-react";

interface UploadPanelProps {
  pdfs: File[];
  urls: string[];
  isLoading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onUploadPdfs: () => void;
  onUrlsChange: (urls: string[]) => void;
  onInitializeVectorIndex: () => void;
}

export function UploadPanel({
  pdfs,
  urls,
  isLoading,
  onFileChange,
  onRemoveFile,
  onUploadPdfs,
  onUrlsChange,
  onInitializeVectorIndex,
}: UploadPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          <FileText className="w-4 h-4 inline mr-1" />
          Upload PDFs
        </label>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={onFileChange}
          className="block w-full text-sm text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100"
        />
        {pdfs.length > 0 && (
          <div className="mt-2 space-y-1">
            {pdfs.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                <span className="truncate text-gray-800">{file.name}</span>
                <button onClick={() => onRemoveFile(index)} className="text-red-500 hover:text-red-700" type="button">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onUploadPdfs}
          disabled={isLoading || pdfs.length === 0}
          className="mt-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
          type="button"
        >
          {isLoading ? "Uploading..." : "Upload PDFs"}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-800">
          <LinkIcon className="w-4 h-4 inline mr-1" />
          Process URLs
        </label>
        {urls.map((url, index) => (
          <input
            key={`url-${index}`}
            type="text"
            value={url}
            onChange={(e) => {
              const nextUrls = [...urls];
              nextUrls[index] = e.target.value;
              onUrlsChange(nextUrls);
            }}
            placeholder="Enter URL"
            className="w-full mb-2 px-3 py-2 border rounded text-sm text-gray-800 placeholder-gray-400"
          />
        ))}
        <div className="flex gap-2">
          <button onClick={() => onUrlsChange([...urls, ""])} className="text-sm text-blue-600 hover:text-blue-800" type="button">
            + Add URL
          </button>
          {urls.length > 1 && (
            <button onClick={() => onUrlsChange(urls.slice(0, -1))} className="text-sm text-red-600 hover:text-red-800" type="button">
              Remove
            </button>
          )}
        </div>
        <button
          onClick={onInitializeVectorIndex}
          disabled={isLoading || urls.filter((u) => u.trim()).length === 0}
          className="mt-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
          type="button"
        >
          Process URLs
        </button>
      </div>
    </div>
  );
}
