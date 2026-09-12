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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-3 md:p-6 bg-black/40 backdrop-blur-[3px] animate-backdrop-in"
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
