import React from 'react';
import AdminSettingsShell from './admin/AdminSettingsShell.jsx';

export default function SettingsModal({
  isOpen = false,
  onClose = () => {},
  onSaveConfig = () => {},
  roomId = 'MAIN'
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 bg-black/60 dark:bg-black/75 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <AdminSettingsShell
        variant="modal"
        isOpen={isOpen}
        onClose={onClose}
        roomId={roomId}
        onSaveConfig={onSaveConfig}
      />
    </div>
  );
}
