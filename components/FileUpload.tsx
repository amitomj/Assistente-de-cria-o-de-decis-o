import React from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  file,
  onFileSelect,
  onRemove,
  accept = ".pdf,.docx,.txt"
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <label className="flex flex-col items-center justify-center w-full h-20 border border-slate-600 rounded bg-input-bg cursor-pointer hover:bg-slate-700 transition-colors group relative overflow-hidden">
            <div className="flex flex-row items-center justify-center gap-3 relative z-10">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">{label}</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept={accept}
              onChange={handleFileChange}
            />
        </label>
      ) : (
        <div className="flex items-center justify-between p-3 bg-input-bg rounded border border-slate-600 group hover:border-slate-500 transition-all">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="bg-primary/20 p-2 rounded shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate pr-2">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-slate-600 text-slate-400 hover:text-white rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};