import React, { useCallback, useEffect, useRef, useState } from 'react';
import EditorYjs from './EditorYjs';
import '@kerebron/editor/assets/vars.css';
import './App.css';

// Generate human-readable room names
const adjectives = [
  'red',
  'blue',
  'green',
  'happy',
  'swift',
  'calm',
  'bright',
  'cool',
  'warm',
  'wild',
];
const nouns = [
  'fox',
  'owl',
  'bear',
  'wolf',
  'hawk',
  'deer',
  'lion',
  'tiger',
  'eagle',
  'whale',
];

function generateRoomName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

// Generate random user names
const nameAdjectives = [
  'Happy',
  'Clever',
  'Swift',
  'Brave',
  'Gentle',
  'Mighty',
  'Silent',
  'Curious',
  'Friendly',
  'Wise',
];
const nameNouns = [
  'Panda',
  'Phoenix',
  'Dragon',
  'Unicorn',
  'Dolphin',
  'Falcon',
  'Wizard',
  'Knight',
  'Ninja',
  'Pirate',
];

function generateUserName(): string {
  const adj = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
  const noun = nameNouns[Math.floor(Math.random() * nameNouns.length)];
  return `${adj} ${noun}`;
}

const THEME_KEY = 'kerebron-theme';

const App: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomIDs, setRoomIDs] = useState<string[]>([]);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState(generateUserName);
  const [isLightMode, setIsLightMode] = useState(false);
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const [roomsDropdownOpen, setRoomsDropdownOpen] = useState(false);
  const roomsDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch list of existing rooms from backend
  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const ids: string[] = await response.json();
        setRoomIDs(ids);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, []);

  // Parse room from hash
  const parseRoomFromHash = useCallback(() => {
    const docUrl = window.location.hash.slice(1);
    if (docUrl.startsWith('room:')) {
      setRoomId(docUrl.substring('room:'.length));
    } else {
      // Auto-create a room with a friendly name
      const newRoomId = generateRoomName();
      window.location.hash = 'room:' + newRoomId;
      setRoomId(newRoomId);
    }
  }, []);

  // Load theme from localStorage
  const loadTheme = useCallback(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      setIsLightMode(saved === 'light');
      setThemeOverride(saved);
    } else {
      setIsLightMode(
        window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
      );
      setThemeOverride(null);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadTheme();
    fetchRooms();
    parseRoomFromHash();

    const onHashChange = () => {
      const docUrl = window.location.hash.slice(1);
      if (docUrl.startsWith('room:')) {
        const newRoomId = docUrl.substring('room:'.length);
        setRoomId(newRoomId);
        fetchRooms();
      }
    };

    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!themeOverride) {
        setIsLightMode(e.matches);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    window.matchMedia?.('(prefers-color-scheme: light)')
      .addEventListener('change', onSystemThemeChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.matchMedia?.('(prefers-color-scheme: light)')
        .removeEventListener('change', onSystemThemeChange);
    };
  }, [fetchRooms, loadTheme, parseRoomFromHash, themeOverride]);

  // Close rooms dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        roomsDropdownRef.current &&
        !roomsDropdownRef.current.contains(e.target as Node)
      ) {
        setRoomsDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const newRoom = () => {
    const newRoomId = generateRoomName();
    window.location.hash = 'room:' + newRoomId;
  };

  const joinRoom = () => {
    const trimmed = joinRoomInput.trim();
    if (trimmed) {
      window.location.hash = 'room:' + trimmed;
      setJoinRoomInput('');
    }
  };

  const switchRoom = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = 'room:' + id;
    setRoomsDropdownOpen(false);
  };

  const copyRoomLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const randomizeName = () => {
    setUserName(generateUserName());
  };

  const toggleTheme = () => {
    const newIsLight = !isLightMode;
    setIsLightMode(newIsLight);
    const newOverride = newIsLight ? 'light' : 'dark';
    setThemeOverride(newOverride);
    localStorage.setItem(THEME_KEY, newOverride);
  };

  const resetThemeToSystem = () => {
    localStorage.removeItem(THEME_KEY);
    setThemeOverride(null);
    setIsLightMode(
      window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
    );
  };

  return (
    <div className={`app-container ${isLightMode ? 'light-mode' : ''}`}>
      {/* Compact toolbar */}
      <div className='toolbar-row'>
        <span className='app-title'>YJS + React</span>

        {/* User name input */}
        <div className='toolbar-group'>
          <input
            type='text'
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder='Your name'
            className='compact-input name-input'
          />
          <button
            onClick={randomizeName}
            className='icon-btn'
            title='Random name'
          >
            🎲
          </button>
        </div>

        {/* Room info */}
        <div className='toolbar-group'>
          <span className='label'>Room:</span>
          <code className='room-id'>{roomId}</code>
          <button
            onClick={copyRoomLink}
            className='icon-btn'
            title={copied ? 'Copied!' : 'Copy link'}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>

        {/* New/Join room */}
        <div className='toolbar-group'>
          <button onClick={newRoom} className='compact-btn'>
            New
          </button>
          <input
            type='text'
            value={joinRoomInput}
            onChange={(e) => setJoinRoomInput(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && joinRoom()}
            placeholder='Join room...'
            className='compact-input room-input'
          />
          <button
            onClick={joinRoom}
            disabled={!joinRoomInput.trim()}
            className='compact-btn'
          >
            Join
          </button>
        </div>

        {/* Right side: rooms dropdown & theme toggle */}
        <div className='toolbar-group toolbar-right'>
          {/* Rooms dropdown */}
          <div className='rooms-dropdown' ref={roomsDropdownRef}>
            <button
              onClick={() => setRoomsDropdownOpen(!roomsDropdownOpen)}
              className='icon-btn rooms-dropdown-toggle'
              title='Recent rooms'
            >
              📁 {roomIDs.length}
            </button>
            {roomsDropdownOpen && (
              <ul className='rooms-list'>
                {roomIDs.map((id) => (
                  <li key={id} className={id === roomId ? 'active' : ''}>
                    <a
                      href={`#room:${id}`}
                      onClick={(e) =>
                        switchRoom(id, e)}
                    >
                      {id}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            onDoubleClick={resetThemeToSystem}
            className={`icon-btn theme-btn ${
              themeOverride ? 'has-override' : ''
            }`}
            title={themeOverride
              ? `${
                isLightMode ? 'Light' : 'Dark'
              } mode (override). Double-click to follow system.`
              : `Following system (${
                isLightMode ? 'light' : 'dark'
              }). Click to override.`}
          >
            {isLightMode ? '🌙' : '☀️'}
            {themeOverride && <span className='override-dot'>•</span>}
          </button>
        </div>
      </div>

      {/* Editor */}
      {roomId
        ? <EditorYjs key={roomId} roomId={roomId} userName={userName} />
        : (
          <div className='no-room-message'>
            Select a room or create a new one to start editing collaboratively
          </div>
        )}
    </div>
  );
};

export default App;
