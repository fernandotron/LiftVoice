import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import QRCodeModal from './components/QRCodeModal.jsx';
import HomeView from './views/HomeView.jsx';
import HostView from './views/HostView.jsx';
import ListenerView from './views/ListenerView.jsx';
import VoicesView from './views/VoicesView.jsx';
import { socketService } from './services/socket.js';

export function generateMeetRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getRand = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `${getRand(3)}-${getRand(4)}-${getRand(3)}`;
}

export function normalizeRoomCode(input) {
  if (!input) return '';
  const s = String(input).trim().toLowerCase();
  const m = s.match(/room=([a-z0-9\-]+)/i);
  const clean = (m ? m[1] : s).replace(/\s+/g, '');
  if (/^[a-z]{10}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 10)}`;
  }
  return clean;
}

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'host' | 'listener'
  const [roomId, setRoomId] = useState(null);
  const [roomTitle, setRoomTitle] = useState('Conferencia Principal 2026');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(12);
  const [localIp, setLocalIp] = useState('192.168.1.12');

  // Detect URL search params or paths on initial load
  useEffect(() => {
    // Fetch network info from server to obtain local IP
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data.localIp) setLocalIp(data.localIp);
      })
      .catch(() => {});

    // Parse URL helper
    const parseUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      let roomParam = params.get('room');
      const isHostParam = params.get('host') === 'true' || window.location.pathname.includes('/host');

      if (!roomParam && isHostParam) {
        roomParam = localStorage.getItem('lv_active_room_id') || generateMeetRoomCode();
        window.history.replaceState({}, '', `?room=${roomParam}&host=true`);
      }

      if (roomParam) {
        const normalized = normalizeRoomCode(roomParam);
        setRoomId(normalized);
        localStorage.setItem('lv_active_room_id', normalized);
        setRoomTitle(`Sala ${normalized}`);
        setCurrentView(isHostParam ? 'host' : 'listener');
      } else {
        setRoomId(null);
        setCurrentView('home');
      }
    };

    parseUrlState();

    const handlePopState = () => {
      parseUrlState();
    };
    window.addEventListener('popstate', handlePopState);

    // Subscribe to socket connection events
    const unsubConn = socketService.on('connection_status', (status) => {
      setIsConnected(status.connected);
    });

    const unsubLat = socketService.on('latency', (lat) => {
      setLatency(lat);
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubConn();
      unsubLat();
    };
  }, []);

  const handleCreateRoom = (customId) => {
    const id = customId ? normalizeRoomCode(customId) : generateMeetRoomCode();
    setRoomId(id);
    localStorage.setItem('lv_active_room_id', id);
    setRoomTitle(`Sala ${id}`);
    setCurrentView('host');
    window.history.pushState({}, '', `?room=${id}&host=true`);
  };

  const handleJoinRoom = (id) => {
    const cleanId = normalizeRoomCode(id);
    setRoomId(cleanId);
    localStorage.setItem('lv_active_room_id', cleanId);
    setRoomTitle(`Sala ${cleanId}`);
    setCurrentView('listener');
    window.history.pushState({}, '', `?room=${cleanId}`);
  };

  const handleLeave = () => {
    localStorage.removeItem('lv_active_room_id');
    setCurrentView('home');
    setRoomId(null);
    window.history.pushState({}, '', window.location.pathname || '/');
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-zinc-900 flex flex-col justify-between selection:bg-zinc-200 selection:text-zinc-900">
      {/* Top Navigation for Home & Listener (HostView and VoicesView render native ElevenLabs layout) */}
      {currentView !== 'host' && currentView !== 'voices' && (
        <Navbar
          currentRole={currentView === 'home' ? null : currentView}
          roomId={roomId}
          latency={latency}
          isConnected={isConnected}
          onOpenQR={() => setIsQrOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNavigateHome={handleLeave}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentView === 'host' && (
          <HostView
            roomId={roomId}
            roomTitle={roomTitle}
            onLeave={handleLeave}
            localIp={localIp}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onNavigateVoices={() => setCurrentView('voices')}
          />
        )}

        {currentView === 'voices' && (
          <VoicesView
            roomId={roomId || 'MAIN'}
            onNavigateStudio={() => setCurrentView('host')}
            onNavigateHome={handleLeave}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenQR={() => setIsQrOpen(true)}
          />
        )}

        {currentView === 'listener' && (
          <ListenerView
            roomId={roomId}
            onLeave={handleLeave}
          />
        )}
      </main>

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        roomId={roomId}
      />

      <QRCodeModal
        roomId={roomId || 'MAIN'}
        roomTitle={roomTitle}
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        localIp={localIp}
      />
    </div>
  );
}
