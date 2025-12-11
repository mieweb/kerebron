import React, { useEffect, useState } from 'react';
import EditorYjs from './EditorYjs';

import '@kerebron/editor/assets/index.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

const App: React.FC = () => {
  const [roomIDs, setRoomIDs] = useState<string[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // Fetch list of existing rooms from backend
  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const ids: string[] = await response.json();
        setRoomIDs(ids);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  // Read current room from URL hash on mount and on hash change
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('room:')) {
        setCurrentRoomId(hash.substring('room:'.length));
      } else {
        setCurrentRoomId(null);
      }
    };

    readHash(); // initial
    window.addEventListener('hashchange', readHash);
    fetchRooms();

    return () => {
      window.removeEventListener('hashchange', readHash);
    };
  }, []);

  // Refresh room list when entering a new room
  useEffect(() => {
    if (currentRoomId) {
      fetchRooms();
    }
  }, [currentRoomId]);

  const newRoom = () => {
    const newId = Math.random().toString(36).substring(2, 12);
    window.location.hash = 'room:' + newId;
    // hashchange will update currentRoomId
  };

  return (
    <div>
      <h2>Yjs + React Demo</h2>
      <button onClick={newRoom}>New Room</button>

      <>
        {roomIDs.length === 0 ? <p>No rooms yet. Create one above!</p> : (
          <ul>
            {roomIDs.map((id) => (
              <li key={id}>
                <a href={`#room:${id}`}>{id}</a>
              </li>
            ))}
          </ul>
        )}
      </>

      <section>
        {currentRoomId
          ? (
            <>
              <EditorYjs />
            </>
          )
          : (
            <p>
              Select a room or create a new one to start editing collaboratively
            </p>
          )}
      </section>
    </div>
  );
};

export default App;
