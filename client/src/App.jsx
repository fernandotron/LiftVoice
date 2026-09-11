import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import QRCodeModal from './components/QRCodeModal.jsx';
import HomeView from './views/HomeView.jsx';
import HostView from './views/HostView.jsx';
import ListenerView from './views/ListenerView.jsx';
import VoicesView from './views/VoicesView.jsx';
import PostLeaveView from './views/PostLeaveView.jsx';
import AttendeeLobbyView from './views/AttendeeLobbyView.jsx';
import { socketService } from './services/socket.js';
import { audioPlayerService } from './services/audioPlayer.js';

export function hasValidAttendeeProfile() {
  try {
    const saved = localStorage.getItem('lv_attendee_profile');
    if (saved) {
      const p = JSON.parse(saved);
      const hasValidName = p.name && p.name.trim().length >= 2 && p.name.trim() !== 'Oyente';
      const hasValidEmail = p.email && p.email.trim().includes('@');
      return Boolean(hasValidName && hasValidEmail);
    }
  } catch (e) {}
  return false;
}

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
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'host' | 'listener' | 'post-leave'
  const [leaveDetails, setLeaveDetails] = useState(null); // { roomId, selectedLanguage, reason, message }
  const [roomId, setRoomId] = useState(null);
  const [roomTitle, setRoomTitle] = useState('Conferencia Principal 2026');
  const [pendingJoinRoom, setPendingJoinRoom] = useState(null); // { roomId, lang }
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
        if (isHostParam) {
          setRoomId(normalized);
          localStorage.setItem('lv_active_room_id', normalized);
          setRoomTitle(`Sala ${normalized}`);
          setCurrentView('host');
        } else {
          // Listener entry via direct URL/QR: check if identified first
          if (hasValidAttendeeProfile()) {
            setRoomId(normalized);
            localStorage.setItem('lv_active_room_id', normalized);
            setRoomTitle(`Sala ${normalized}`);
            setCurrentView('listener');
          } else {
            // Unidentified listener: show Lobby screen BEFORE entering room!
            setPendingJoinRoom({ roomId: normalized, lang: params.get('lang') });
            setRoomId(normalized);
            setRoomTitle(`Sala ${normalized}`);
            setCurrentView('lobby');
          }
        }
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

  const handleJoinRoom = (id, lang = null) => {
    const cleanId = normalizeRoomCode(id);
    if (hasValidAttendeeProfile()) {
      // Returning identified listener: enter directly into room
      setRoomId(cleanId);
      localStorage.setItem('lv_active_room_id', cleanId);
      if (lang) {
        try {
          localStorage.setItem('lv_preferred_lang', lang);
        } catch (e) {}
      }
      setRoomTitle(`Sala ${cleanId}`);
      setCurrentView('listener');
      const query = lang ? `?room=${cleanId}&lang=${lang}` : `?room=${cleanId}`;
      window.history.pushState({}, '', query);
    } else {
      // First-time listener: open Lobby screen BEFORE entering room!
      setPendingJoinRoom({ roomId: cleanId, lang });
      setRoomId(cleanId);
      setRoomTitle(`Sala ${cleanId}`);
      setCurrentView('lobby');
      const query = lang ? `?room=${cleanId}&lang=${lang}` : `?room=${cleanId}`;
      window.history.pushState({}, '', query);
    }
  };

  const handleCheckInComplete = (profileData) => {
    if (!pendingJoinRoom) return;
    const { roomId: targetRoomId, lang: targetLang } = pendingJoinRoom;
    const cleanId = normalizeRoomCode(targetRoomId);

    try {
      const existing = JSON.parse(localStorage.getItem('lv_attendee_profile') || '{}');
      const updated = {
        attendeeId: existing.attendeeId || `att_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
        name: profileData.name.trim(),
        email: profileData.email.trim(),
        phone: (profileData.phone || '').trim()
      };
      localStorage.setItem('lv_attendee_profile', JSON.stringify(updated));
    } catch (e) {}

    // Unlock Web Audio context via user gesture immediately
    audioPlayerService.unlockAudio(cleanId, targetLang || 'es').catch(() => {});

    setPendingJoinRoom(null);
    setRoomId(cleanId);
    localStorage.setItem('lv_active_room_id', cleanId);
    if (targetLang) {
      try {
        localStorage.setItem('lv_preferred_lang', targetLang);
      } catch (e) {}
    }
    setRoomTitle(`Sala ${cleanId}`);
    setCurrentView('listener');
    const query = targetLang ? `?room=${cleanId}&lang=${targetLang}` : `?room=${cleanId}`;
    window.history.pushState({}, '', query);
  };

  const handleCheckInClose = () => {
    setPendingJoinRoom(null);
    setCurrentView('home');
    if (window.location.search.includes('room=')) {
      window.history.replaceState({}, '', window.location.pathname || '/');
    }
  };

  const handleLeave = (options = {}) => {
    const roomToLeave = roomId || localStorage.getItem('lv_active_room_id') || localStorage.getItem('lv_last_room_id');
    const userLang = options?.selectedLanguage || localStorage.getItem('lv_preferred_lang') || 'es';
    const reason = options?.reason || 'voluntary';

    localStorage.removeItem('lv_active_room_id');

    if (reason === 'kicked') {
      try {
        const banned = JSON.parse(localStorage.getItem('lv_banned_rooms') || '{}');
        if (roomToLeave) banned[roomToLeave] = Date.now();
        localStorage.setItem('lv_banned_rooms', JSON.stringify(banned));
        localStorage.removeItem('lv_recent_room');
      } catch (e) {}
    } else if (roomToLeave) {
      try {
        localStorage.setItem('lv_recent_room', JSON.stringify({
          roomId: roomToLeave,
          lang: userLang,
          timestamp: Date.now()
        }));
      } catch (e) {}
    }

    if (currentView === 'listener' || options?.reason) {
      setLeaveDetails({
        roomId: roomToLeave,
        selectedLanguage: userLang,
        reason,
        message: options?.message || ''
      });
      setRoomId(null);
      setCurrentView('post-leave');
      window.history.pushState({}, '', window.location.pathname || '/');
    } else {
      setRoomId(null);
      setCurrentView('home');
      window.history.pushState({}, '', window.location.pathname || '/');
    }
  };

  const handleRejoin = (targetRoomId, targetLang) => {
    handleJoinRoom(targetRoomId, targetLang);
  };

  const handleNavigateHome = () => {
    setLeaveDetails(null);
    setCurrentView('home');
  };

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-150">
      {/* Top Navigation for Home only (Host, Voices and Listener render their own native studio layout) */}
      {(currentView === 'home' || currentView === 'post-leave') && (
        <Navbar
          currentRole={null}
          roomId={roomId}
          latency={latency}
          isConnected={isConnected}
          onOpenQR={() => setIsQrOpen(true)}
          onOpenSettings={undefined}
          onNavigateHome={handleNavigateHome}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0">
        {(currentView === 'home' || currentView === 'post-leave') && (
          <HomeView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentView === 'lobby' && (
          <AttendeeLobbyView
            roomId={pendingJoinRoom?.roomId || roomId || 'MAIN'}
            onBack={handleCheckInClose}
            onSubmit={handleCheckInComplete}
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
            onNavigateHome={handleNavigateHome}
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

        {currentView === 'post-leave' && (
          <PostLeaveView
            roomId={leaveDetails?.roomId}
            selectedLanguage={leaveDetails?.selectedLanguage || 'es'}
            leaveReason={leaveDetails?.reason || 'voluntary'}
            leaveMessage={leaveDetails?.message || ''}
            onRejoin={handleRejoin}
            onNavigateHome={handleNavigateHome}
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
