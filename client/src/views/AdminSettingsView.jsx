import React from 'react';
import AdminSettingsShell from '../components/admin/AdminSettingsShell.jsx';

export default function AdminSettingsView({
  roomId = null,
  onNavigateHost = null,
  onNavigateHome = null,
  onSaveConfig = null
}) {
  return (
    <AdminSettingsShell
      variant="page"
      roomId={roomId}
      onNavigateHost={onNavigateHost}
      onNavigateHome={onNavigateHome}
      onSaveConfig={onSaveConfig}
    />
  );
}
