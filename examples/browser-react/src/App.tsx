import React, { useCallback, useEffect, useRef, useState } from 'react';
import EditorYjs from './EditorYjs';
import '@kerebron/editor/assets/vars.css';
import './App.css';

// Get current example name from URL path
function getCurrentExample(): string {
  const path = globalThis.location.pathname;
  const match = path.match(/examples-frame\/(browser-[^/]+)/);
  return match ? match[1] : 'browser-react';
}

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
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [examples, setExamples] = useState<string[]>([]);
  const currentExample = getCurrentExample();

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

  // Fetch list of available examples from backend
  const fetchExamples = useCallback(async () => {
    try {
      const response = await fetch('/api/examples');
      if (response.ok) {
        const examplesList: string[] = await response.json();
        setExamples(examplesList);
      }
    } catch (err) {
      console.error('Failed to fetch examples:', err);
    }
  }, []);

  // Parse room from hash
  const parseRoomFromHash = useCallback(() => {
    const docUrl = globalThis.location.hash.slice(1);
    if (docUrl.startsWith('room:')) {
      setRoomId(docUrl.substring('room:'.length));
    } else {
      // Auto-create a room with a friendly name
      const newRoomId = generateRoomName();
      globalThis.location.hash = 'room:' + newRoomId;
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
        globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ??
          false,
      );
      setThemeOverride(null);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadTheme();
    fetchRooms();
    fetchExamples();
    parseRoomFromHash();

    const onHashChange = () => {
      const docUrl = globalThis.location.hash.slice(1);
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

    globalThis.addEventListener('hashchange', onHashChange);
    globalThis.matchMedia?.('(prefers-color-scheme: light)')
      .addEventListener('change', onSystemThemeChange);

    return () => {
      globalThis.removeEventListener('hashchange', onHashChange);
      globalThis.matchMedia?.('(prefers-color-scheme: light)')
        .removeEventListener('change', onSystemThemeChange);
    };
  }, [fetchExamples, fetchRooms, loadTheme, parseRoomFromHash, themeOverride]);

  // Close rooms dropdown and nav menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        roomsDropdownRef.current &&
        !roomsDropdownRef.current.contains(e.target as Node)
      ) {
        setRoomsDropdownOpen(false);
      }
      if (
        navMenuRef.current &&
        !navMenuRef.current.contains(e.target as Node)
      ) {
        setNavMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const newRoom = () => {
    const newRoomId = generateRoomName();
    globalThis.location.hash = 'room:' + newRoomId;
  };

  const joinRoom = () => {
    const trimmed = joinRoomInput.trim();
    if (trimmed) {
      globalThis.location.hash = 'room:' + trimmed;
      setJoinRoomInput('');
    }
  };

  const switchRoom = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    globalThis.location.hash = 'room:' + id;
    setRoomsDropdownOpen(false);
  };

  const copyRoomLink = async () => {
    const url = globalThis.location.href;
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
      globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
    );
  };

  const navigateToExample = (example: string) => {
    globalThis.location.href = `/examples-frame/${example}/`;
  };

  return (
    <div className={`app-container ${isLightMode ? 'light-mode' : ''}`}>
      {/* Compact toolbar */}
      <div className='toolbar-row'>
        {/* Hamburger menu for navigation */}
        <div className='nav-menu' ref={navMenuRef}>
          <button
            type='button'
            onClick={() => setNavMenuOpen(!navMenuOpen)}
            className='icon-btn hamburger-btn'
            title='Examples'
            aria-label='Toggle navigation menu'
          >
            ☰
          </button>
          {navMenuOpen && (
            <ul className='nav-menu-list'>
              {examples.map((example) => (
                <li
                  key={example}
                  className={example === currentExample ? 'active' : ''}
                >
                  <button
                    type='button'
                    onClick={() => navigateToExample(example)}
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
            type='button'
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
            type='button'
            onClick={copyRoomLink}
            className='icon-btn'
            title={copied ? 'Copied!' : 'Copy link'}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>

        {/* New/Join room */}
        <div className='toolbar-group'>
          <button type='button' onClick={newRoom} className='compact-btn'>
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
            type='button'
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
              type='button'
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
            type='button'
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
        ? (
          <EditorYjs
            key={roomId}
            roomId={roomId}
            userName={userName}
            isLightMode={isLightMode}
          />
        )
        : (
          <div className='no-room-message'>
            Select a room or create a new one to start editing collaboratively
          </div>
        )}
    </div>
  );
};

export default App;
