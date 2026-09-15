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
      className="fixed inset-0 z-[100] w-full h-full h-dvh md:h-auto md:w-auto md:flex md:items-center md:justify-center md:p-4 bg-white dark:bg-zinc-950 md:bg-black/60 md:dark:bg-black/75 animate-fadeIn overflow-hidden"
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
