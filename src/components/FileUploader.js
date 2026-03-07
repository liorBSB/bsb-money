'use client';

import { useCallback, useState } from 'react';
import colors from '@/app/colors';

export default function FileUploader({ onFileProcessed, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      alert('יש להעלות קובץ אקסל (.xls / .xlsx)');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      onFileProcessed(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  }, [onFileProcessed]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const onInputChange = useCallback((e) => {
    handleFile(e.target.files?.[0]);
  }, [handleFile]);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className="rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer"
      style={{
        borderColor: dragging ? colors.primaryGreen : colors.gray400,
        backgroundColor: dragging ? 'rgba(7, 99, 50, 0.05)' : colors.surface,
      }}
      onClick={() => {
        if (!disabled) document.getElementById('file-input')?.click();
      }}
    >
      <input
        id="file-input"
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-3">
        <svg className="w-12 h-12" style={{ color: colors.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {fileName ? (
          <p className="text-lg font-medium" style={{ color: colors.primaryGreen }}>
            {fileName}
          </p>
        ) : (
          <>
            <p className="text-lg font-medium" style={{ color: colors.text }}>
              גרור קובץ אקסל לכאן או לחץ לבחירה
            </p>
            <p className="text-sm" style={{ color: colors.muted }}>
              .xlsx / .xls
            </p>
          </>
        )}
      </div>
    </div>
  );
}
