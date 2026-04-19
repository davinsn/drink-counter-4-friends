'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Player = {
  id: string;
  username: string;
  drink_count: number;
  created_at: string;
  updated_at: string;
};

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [username, setUsername] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentPlayer = useMemo(
    () => players.find((p) => p.username.toLowerCase() === currentUser.toLowerCase()),
    [players, currentUser]
  );

  const topPlayer = players.length > 0 ? players[0] : null;

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('drink_count', { ascending: false })
      .order('updated_at', { ascending: true });

    if (error) {
      setMessage(`Error loading leaderboard: ${error.message}`);
      return;
    }

    setPlayers(data ?? []);
  }

  useEffect(() => {
    fetchPlayers();

    const channel = supabase
      .channel('players-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    const savedUser = localStorage.getItem('drink_counter_username');
    if (savedUser) {
      setCurrentUser(savedUser);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function joinGame() {
    const clean = username.trim();

    if (!clean) {
      setMessage('Please enter a username.');
      return;
    }

    if (clean.length < 2) {
      setMessage('Username must be at least 2 characters.');
      return;
    }

    setLoading(true);
    setMessage('');

    const { data: existing, error: existingError } = await supabase
      .from('players')
      .select('*')
      .ilike('username', clean)
      .maybeSingle();

    if (existingError) {
      setLoading(false);
      setMessage(existingError.message);
      return;
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('players')
        .insert([{ username: clean, drink_count: 0 }]);

      if (insertError) {
        setLoading(false);
        setMessage(insertError.message);
        return;
      }
    }

    localStorage.setItem('drink_counter_username', clean);
    setCurrentUser(clean);
    setUsername('');
    setLoading(false);
    setMessage(`You joined as ${clean}.`);
    fetchPlayers();
  }

  async function changeDrinkCount(amount: number) {
    if (!currentPlayer) {
      setMessage('Join the game first.');
      return;
    }

    const newCount = Math.max(0, currentPlayer.drink_count + amount);

    const { error } = await supabase
      .from('players')
      .update({ drink_count: newCount })
      .eq('id', currentPlayer.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('');
    fetchPlayers();
  }

  function logoutUser() {
    localStorage.removeItem('drink_counter_username');
    setCurrentUser('');
    setMessage('You have left this device session.');
  }

  return (
    <main className="container">
      <div className="hero">
        <h1>Drink Counter</h1>
        <p className="subtitle">
          Track drinks, compete with friends, and see who is leading the night.
        </p>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Player Panel</h2>

          {!currentUser ? (
            <>
              <label htmlFor="username" className="label">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                maxLength={20}
              />
              <button onClick={joinGame} disabled={loading} className="button">
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            </>
          ) : (
            <>
              <p className="current-user">
                Playing as <strong>{currentUser}</strong>
              </p>

              <div className="counter-box">
                <p className="count-label">Your drink count</p>
                <p className="count-number">{currentPlayer?.drink_count ?? 0}</p>
              </div>

              <div className="button-row">
                <button className="button danger" onClick={() => changeDrinkCount(-1)}>
                  -1 Drink
                </button>
                <button className="button success" onClick={() => changeDrinkCount(1)}>
                  +1 Drink
                </button>
              </div>

              <button className="button secondary" onClick={logoutUser}>
                Switch User
              </button>
            </>
          )}

          {message && <p className="message">{message}</p>}
        </section>

        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '18px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ marginBottom: '6px' }}>Leaderboard</h2>
              <p style={{ margin: 0, color: '#8c8c96', fontSize: '0.85rem' }}>
                Live ranking by total drinks
              </p>
            </div>

            <div
              style={{
                background: '#0b0b0d',
                border: '1px solid #232326',
                borderRadius: '12px',
                padding: '10px 14px',
                minWidth: '160px',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#8c8c96', marginBottom: '4px' }}>
                Total Players
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{players.length}</div>
            </div>
          </div>

          {topPlayer && (
            <div
              style={{
                background: '#140c12',
                border: '1px solid #ff4fa3',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#ff9bc9', marginBottom: '8px' }}>
                🏆 Top Player
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{topPlayer.username}</div>
                <div style={{ color: '#ff4fa3', fontWeight: 700, fontSize: '1.1rem' }}>
                  {topPlayer.drink_count}
                </div>
              </div>
            </div>
          )}

          {players.length === 0 ? (
            <p style={{ color: '#8c8c96' }}>No players yet.</p>
          ) : (
            <ol className="leaderboard">
              {players.map((player, index) => {
                const isCurrentUser =
                  currentUser &&
                  player.username.toLowerCase() === currentUser.toLowerCase();

                return (
                  <li
                    key={player.id}
                    className={`leaderboard-item ${isCurrentUser ? 'active-player' : ''}`}
                  >
                    <div>
                      <span className="rank">#{index + 1}</span>
                      <span className="player-name">{player.username}</span>
                      {index === 0 && <span className="badge">Top</span>}
                      {isCurrentUser && <span className="badge">You</span>}
                    </div>
                    <strong>{player.drink_count}</strong>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}