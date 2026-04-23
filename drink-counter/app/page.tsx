'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DrinkEvent, DrinkType, Player, Room, RoomMember } from '@/lib/types';

type GlobalPlayerStats = {
  player_id: string;
  display_name: string;
  total_drinks: number;
  water_count: number;
  sessions: number;
  total_points: number;
};

const ROOM_KEY = 'drink_counter_room_code';
const MEMBER_KEY = 'drink_counter_member_id';
const DEVICE_KEY = 'drink_counter_device_key';
const NAME_KEY = 'drink_counter_display_name';

const DRINK_BUTTONS: Array<{ type: DrinkType; label: string; emoji: string; delta: number }> = [
  { type: 'beer', label: 'Beer', emoji: '🍺', delta: 1 },
  { type: 'shot', label: 'Shot', emoji: '🥃', delta: 1 },
  { type: 'cocktail', label: 'Cocktail', emoji: '🍸', delta: 1 },
  { type: 'water', label: 'Water break', emoji: '💧', delta: 1 },
];

const DRINK_POINTS: Record<DrinkType, number> = {
  beer: 5,
  cocktail: 1,
  shot: 10,
  water: -1,
};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getDeviceKey() {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

function formatWhen(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function HomePage() {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('Friday Session');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [events, setEvents] = useState<DrinkEvent[]>([]);
  const [globalLeaders, setGlobalLeaders] = useState<GlobalPlayerStats[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');

  const sortedMembers = [...members].sort((a, b) => {
  if ((b.total_points ?? 0) !== (a.total_points ?? 0)) {
    return (b.total_points ?? 0) - (a.total_points ?? 0);
  }
  return b.total_drinks - a.total_drinks;
});

  const currentMember = useMemo(
    () => members.find((member) => member.id === currentMemberId) ?? null,
    [members, currentMemberId]
  );

  const currentPlayerName = currentMember?.players?.display_name ?? '';
  const leader = sortedMembers[0] ?? null;
  const totalDrinks = sortedMembers.reduce((sum, member) => sum + member.total_drinks, 0);
  const totalWaterBreaks = sortedMembers.reduce((sum, member) => sum + member.water_count, 0);
  const averageDrinks = sortedMembers.length > 0 ? (totalDrinks / sortedMembers.length).toFixed(1) : '0.0';
  const isHost = currentMember?.role === 'host';

  async function fetchGlobalLeaders() {
  const { data, error } = await supabase
    .from('room_members')
    .select('player_id, total_drinks, water_count, total_points, players(id, display_name)');

  if (error) {
    setMessage((current) => current || 'Unable to load global leaderboard.');
    return;
  }

  const grouped = new Map<string, GlobalPlayerStats>();

  for (const row of ((data ?? []) as unknown as RoomMember[])) {
    const playerId = row.player_id;
    const name = row.players?.display_name ?? 'Unknown player';
    const existing = grouped.get(playerId);

    if (existing) {
      existing.total_drinks += row.total_drinks ?? 0;
      existing.water_count += row.water_count ?? 0;
      existing.total_points += row.total_points ?? 0;
      existing.sessions += 1;
    } else {
      grouped.set(playerId, {
        player_id: playerId,
        display_name: name,
        total_drinks: row.total_drinks ?? 0,
        water_count: row.water_count ?? 0,
        total_points: row.total_points ?? 0,
        sessions: 1,
      });
    }
  }

  const ranked = [...grouped.values()].sort((a, b) => {
    if ((b.total_points ?? 0) !== (a.total_points ?? 0)) {
      return (b.total_points ?? 0) - (a.total_points ?? 0);
    }
    if (b.total_drinks !== a.total_drinks) return b.total_drinks - a.total_drinks;
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return a.display_name.localeCompare(b.display_name);
  });

  setGlobalLeaders(ranked);
}

  async function fetchRoomBundle(nextRoomCode: string, nextMemberId?: string) {
    const normalizedCode = nextRoomCode.trim().toUpperCase();

    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (roomError || !roomData) {
      setRoom(null);
      setMembers([]);
      setEvents([]);
      setMessage(roomError?.message ?? 'Room not found.');
      return;
    }

    const { data: memberData, error: memberError } = await supabase
      .from('room_members')
      .select('id, room_id, player_id, role, total_drinks, water_count, total_points, joined_at, players(id, display_name)')
      .eq('room_id', roomData.id);

    const { data: eventData, error: eventError } = await supabase
      .from('drink_events')
      .select('*')
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (memberError || eventError) {
      setMessage(memberError?.message ?? eventError?.message ?? 'Unable to load room data.');
      return;
    }

    setRoom(roomData as Room);
    setMembers((memberData ?? []) as unknown as RoomMember[]);
    setEvents((eventData ?? []) as DrinkEvent[]);

    if (nextMemberId) {
      setCurrentMemberId(nextMemberId);
      localStorage.setItem(MEMBER_KEY, nextMemberId);
    }

    localStorage.setItem(ROOM_KEY, normalizedCode);
    setMessage('');
  }

  useEffect(() => {
    const savedName = localStorage.getItem(NAME_KEY) ?? '';
    const savedRoomCode = localStorage.getItem(ROOM_KEY) ?? '';
    const savedMemberId = localStorage.getItem(MEMBER_KEY) ?? '';

    if (savedName) setDisplayNameInput(savedName);
    fetchGlobalLeaders();

    if (savedRoomCode) {
      setRoomCodeInput(savedRoomCode);
      fetchRoomBundle(savedRoomCode, savedMemberId);
    }
  }, []);

  useEffect(() => {
    const roomChannel = room?.id
      ? supabase
          .channel(`room-${room.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, () => {
            fetchRoomBundle(room.code, currentMemberId || undefined);
            fetchGlobalLeaders();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'drink_events', filter: `room_id=eq.${room.id}` }, () => {
            fetchRoomBundle(room.code, currentMemberId || undefined);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => {
            fetchRoomBundle(room.code, currentMemberId || undefined);
          })
          .subscribe()
      : null;

    const globalChannel = supabase
      .channel('global-room-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, () => {
        fetchGlobalLeaders();
      })
      .subscribe();

    return () => {
      if (roomChannel) supabase.removeChannel(roomChannel);
      supabase.removeChannel(globalChannel);
    };
  }, [room?.id, room?.code, currentMemberId]);

  async function ensureSignedIn() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  if (sessionData.session?.user) {
    return sessionData.session.user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Unable to create anonymous session.');

  return data.user;
}

  async function getOrCreatePlayer(displayName: string) {
  const cleanName = displayName.trim();
  if (cleanName.length < 2) throw new Error('Name too short');

  const deviceKey = getDeviceKey(); // your existing function

  // 1. check if player exists
  const { data: existing, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('device_key', deviceKey)
    .maybeSingle();

  if (fetchError) throw fetchError;

  // 2. if exists → update name
  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('players')
      .update({ display_name: cleanName })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  // 3. if not → insert
  const { data: created, error: insertError } = await supabase
    .from('players')
    .insert({
      device_key: deviceKey,
      display_name: cleanName,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return created;
}

  async function ensureMembership(targetRoom: Room, player: Player, role: 'host' | 'member') {
    const { data: existingMembership, error: membershipError } = await supabase
      .from('room_members')
      .select('id, room_id, player_id, role, total_drinks, water_count, joined_at, players(id, display_name)')
      .eq('room_id', targetRoom.id)
      .eq('player_id', player.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (existingMembership) return existingMembership as unknown as RoomMember;

    const { data: membership, error: insertMembershipError } = await supabase
      .from('room_members')
      .insert([{ room_id: targetRoom.id, player_id: player.id, role }])
      .select('id, room_id, player_id, role, total_drinks, water_count, joined_at, players(id, display_name)')
      .single();

    if (insertMembershipError) throw insertMembershipError;

    return membership as unknown as RoomMember;
  }

  async function handleCreateRoom() {
    try {
      setLoading(true);
      setMessage('');

      const player = await getOrCreatePlayer(displayNameInput);
      localStorage.setItem(NAME_KEY, player.display_name);

      let code = generateRoomCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: existingRoom } = await supabase.from('rooms').select('id').eq('code', code).maybeSingle();
        if (!existingRoom) break;
        code = generateRoomCode();
      }

      const { data: createdRoom, error: roomError } = await supabase
        .from('rooms')
        .insert([{ code, name: roomNameInput.trim() || 'Untitled Session', is_active: true }])
        .select('*')
        .single();

      if (roomError) throw roomError;

      const membership = await ensureMembership(createdRoom as Room, player, 'host');

      const { error: hostUpdateError } = await supabase
        .from('rooms')
        .update({ host_member_id: membership.id })
        .eq('id', createdRoom.id);

      if (hostUpdateError) throw hostUpdateError;

      await fetchRoomBundle(code, membership.id);
      setRoomCodeInput(code);
      setMessage(`Room ${code} is live. Share the code with your friends.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create room.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    try {
      setLoading(true);
      setMessage('');

      const cleanCode = roomCodeInput.trim().toUpperCase();
      if (cleanCode.length < 4) throw new Error('Enter a valid room code.');

      const player = await getOrCreatePlayer(displayNameInput);
      localStorage.setItem(NAME_KEY, player.display_name);

      const { data: targetRoom, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (roomError || !targetRoom) throw new Error('Room not found or no longer active.');

      const membership = await ensureMembership(targetRoom as Room, player, 'member');
      await fetchRoomBundle(cleanCode, membership.id);
      setMessage(`Joined room ${cleanCode}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to join room.');
    } finally {
      setLoading(false);
    }
  }

  async function logDrink(drinkType: DrinkType, delta: number) {
  if (!room || !currentMember) {
    setMessage('Create or join a room first.');
    return;
  }

  const isWater = drinkType === 'water';
  const basePoints = DRINK_POINTS[drinkType] ?? 0;
  const pointsDelta = basePoints * delta;

  if (!isWater && delta < 0 && currentMember.total_drinks <= 0) {
    setMessage('Your count is already at zero.');
    return;
  }

  if (!isWater && delta < 0 && (currentMember.total_points ?? 0) <= 0) {
    setMessage('Your score is already at zero.');
    return;
  }

  try {
    setBusyAction(drinkType);
    setMessage('');

    const nextTotal = isWater
      ? currentMember.total_drinks
      : Math.max(0, currentMember.total_drinks + delta);

    const nextWater = isWater
      ? Math.max(0, currentMember.water_count + (delta > 0 ? 1 : -1))
      : currentMember.water_count;

    const nextPoints = Math.max(0, (currentMember.total_points ?? 0) + pointsDelta);

    const { error: updateError } = await supabase
      .from('room_members')
      .update({
        total_drinks: nextTotal,
        water_count: nextWater,
        total_points: nextPoints,
      })
      .eq('id', currentMember.id);

    if (updateError) throw updateError;

    const actorName = currentMember.players?.display_name ?? 'Unknown player';
    const { error: eventError } = await supabase.from('drink_events').insert([
      {
        room_id: room.id,
        member_id: currentMember.id,
        actor_name: actorName,
        drink_type: drinkType,
        delta,
        points: pointsDelta,
      },
    ]);

    if (eventError) throw eventError;

    await fetchRoomBundle(room.code, currentMember.id);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Unable to update drinks.');
  } finally {
    setBusyAction('');
  }
}

  async function undoLastDrink() {
  if (!room || !currentMember) return;

  const lastPositive = events.find(
    (event) =>
      event.member_id === currentMember.id &&
      event.delta > 0 &&
      event.drink_type !== 'water'
  );

  if (!lastPositive) {
    setMessage('No recent drink to undo.');
    return;
  }

  await logDrink(lastPositive.drink_type, -1);
}
  async function resetSession() {
    if (!room || !isHost) {
      setMessage('Only the host can reset the room.');
      return;
    }

    try {
      setBusyAction('reset');
      setMessage('');

      await Promise.all(
        members.map((member) =>
          supabase
            .from('room_members')
            .update({ total_drinks: 0, water_count: 0, total_points: 0 })
            .eq('id', member.id)
        )
      );

      await supabase.from('drink_events').delete().eq('room_id', room.id);
      await fetchRoomBundle(room.code, currentMemberId);
      setMessage('Session reset. Fresh start.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reset session.');
    } finally {
      setBusyAction('');
    }
  }

  function leaveRoom() {
    localStorage.removeItem(ROOM_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setRoom(null);
    setMembers([]);
    setEvents([]);
    setCurrentMemberId('');
    setMessage('Left the room on this device.');
  }

  return (
    <main className="container">
      <section className="hero">
        <p className="eyebrow">Realtime social tracker</p>
        <h1>Pint for Pint</h1>
        <p className="subtitle">
          Create a room, invite your friends, log drinks live, and watch the leaderboard update in real time.
        </p>
      </section>

      {!room ? (
        <section className="setup-shell">
          <div className="card setup-card">
            <h2>Start or join a session</h2>
            <label className="label">Display name</label>
            <input
              className="input"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Anonymous Alcoholic"
              maxLength={24}
            />

            <div className="divider" />

            <label className="label">New room name</label>
            <input
              className="input"
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              placeholder="Friday Session"
              maxLength={40}
            />
            <button className="button" onClick={handleCreateRoom} disabled={loading}>
              {loading ? 'Working...' : 'Create room'}
            </button>

            <div className="divider with-text">or</div>

            <label className="label">Room code</label>
            <input
              className="input code-input"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              maxLength={6}
            />
            <button className="button secondary" onClick={handleJoinRoom} disabled={loading}>
              {loading ? 'Joining...' : 'Join room'}
            </button>

            {message ? <p className="message">{message}</p> : null}
          </div>

          <div className="card feature-card">
            <h2>What’s improved</h2>
            <ul className="feature-list">
              <li>Private room codes instead of one global leaderboard</li>
              <li>Realtime session leaderboard and live activity feed</li>
              <li>Drink event history so you can undo and review actions</li>
              <li>Water break tracking and session stats</li>
              <li>Host controls for resets and cleaner group sessions</li>
            </ul>
          </div>
          <div className="card feature-card">
            <div className="section-heading">
              <h2>Global leaderboard</h2>
              <span>All players, all sessions</span>
            </div>

            {globalLeaders.length === 0 ? (
              <p className="empty-state">No player totals yet. Create the first room and start logging drinks.</p>
            ) : (
              <ol className="leaderboard-list compact">
                {globalLeaders.slice(0, 8).map((player, index) => (
                  <li key={player.player_id} className="leaderboard-item">
                    <div className="leaderboard-left">
                      <span className="rank">#{index + 1}</span>
                      <div>
                        <p className="player-name">{player.display_name}</p>
                        <div className="subline">
                          <span>{player.sessions} session{player.sessions === 1 ? '' : 's'}</span>
                          <span>{player.water_count} water</span>
                        </div>
                      </div>
                    </div>
                    <strong>{player.total_drinks}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="room-header card">
            <div>
              <p className="room-label">Active room</p>
              <h2>{room.name}</h2>
              <p className="room-meta">
                Code <strong>{room.code}</strong> · {members.length} player{members.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="header-actions">
              <button className="button secondary compact" onClick={() => navigator.clipboard.writeText(room.code)}>
                Copy code
              </button>
              <button className="button ghost compact" onClick={leaveRoom}>
                Leave room
              </button>
            </div>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <span>Total drinks</span>
              <strong>{totalDrinks}</strong>
            </article>
            <article className="stat-card">
              <span>Water breaks</span>
              <strong>{totalWaterBreaks}</strong>
            </article>
            <article className="stat-card">
              <span>Average per player</span>
              <strong>{averageDrinks}</strong>
            </article>
            <article className="stat-card">
              <span>Current leader</span>
              <strong>{leader?.players?.display_name ?? '—'}</strong>
            </article>
          </section>

          <section className="app-grid">
            <div className="left-column">
              <article className="card player-card">
                <div className="player-topline">
                  <div>
                    <p className="label muted">Playing as</p>
                    <h3>{currentPlayerName || 'Unknown player'}</h3>
                  </div>
                  {isHost ? <span className="pill">Host</span> : null}
                </div>

                <div className="count-box">
                  <span>Your points</span>
                  <strong>{currentMember?.total_points ?? 0}</strong>
                  <small>{currentMember?.total_drinks ?? 0} drinks</small>
                </div>

                <div className="drink-grid">
                  {DRINK_BUTTONS.map((drink) => (
                    <button
                      key={drink.type}
                      className="drink-button"
                      onClick={() => logDrink(drink.type, drink.delta)}
                      disabled={busyAction === drink.type}
                    >
                      <span>{drink.emoji}</span>
                      <strong>{drink.label}</strong>
                    </button>
                  ))}
                </div>

                <div className="button-row">
                  <button className="button secondary" onClick={undoLastDrink}>
                    Undo last drink
                  </button>
                  <button className="button danger" onClick={() => logDrink('beer', -1)}>
                    -1 drink
                  </button>
                </div>

                {isHost ? (
                  <button className="button ghost" onClick={resetSession} disabled={busyAction === 'reset'}>
                    {busyAction === 'reset' ? 'Resetting...' : 'Reset whole session'}
                  </button>
                ) : null}

                {message ? <p className="message">{message}</p> : null}
              </article>

              <article className="card">
                <div className="section-heading">
                  <h2>Activity feed</h2>
                  <span>Latest 20 actions</span>
                </div>
                {events.length === 0 ? (
                  <p className="empty-state">No activity yet. Start the session with the first drink.</p>
                ) : (
                  <ul className="event-list">
                    {events.map((event) => {
                      const actionLabel =
                        event.drink_type === 'water'
                          ? 'took a water break'
                          : event.delta > 0
                            ? `logged a ${event.drink_type}`
                            : `undid a ${event.drink_type}`;

                      return (
                        <li key={event.id} className="event-item">
                          <div>
                            <p>
                              <strong>{event.actor_name}</strong> {actionLabel}
                            </p>
                            <span>{formatWhen(event.created_at)}</span>
                          </div>
                          <span className={`event-badge ${event.delta < 0 ? 'negative' : ''}`}>
                            {event.drink_type === 'water' ? '💧' : event.delta > 0 ? '+1' : '-1'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            </div>

            <div className="right-column">
              <article className="card leaderboard-card">
                <div className="section-heading">
                  <h2>Room leaderboard</h2>
                  <span>Live room ranking</span>
                </div>

                {sortedMembers.length === 0 ? (
                  <p className="empty-state">Nobody is in this room yet.</p>
                ) : (
                  <ol className="leaderboard-list">
                    {sortedMembers.map((member, index) => {
                      const isCurrent = member.id === currentMemberId;
                      const name = member.players?.display_name ?? 'Unknown player';

                      return (
                        <li key={member.id} className={`leaderboard-item ${isCurrent ? 'active' : ''}`}>
                          <div className="leaderboard-left">
                            <span className="rank">#{index + 1}</span>
                            <div>
                              <p className="player-name">{name}</p>
                              <div className="subline">
                                {index === 0 ? <span className="mini-pill">Leading</span> : null}
                                {isCurrent ? <span className="mini-pill alt">You</span> : null}
                                {member.role === 'host' ? <span className="mini-pill alt">Host</span> : null}
                                <span>{member.water_count} water</span>
                              </div>
                            </div>
                          </div>
                          <div className="leaderboard-score">
                            <strong>{member.total_points ?? 0}</strong>
                            <small>pts</small>
                          </div>
                          <span>{member.total_drinks} drinks</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>

              <article className="card leaderboard-card">
                <div className="section-heading">
                  <h2>Global leaderboard</h2>
                  <span>All players, all sessions</span>
                </div>

                {globalLeaders.length === 0 ? (
                  <p className="empty-state">No player totals yet.</p>
                ) : (
                  <ol className="leaderboard-list compact">
                    {globalLeaders.map((player, index) => {
                      const isCurrentGlobal = currentMember?.player_id === player.player_id;

                      return (
                        <li key={player.player_id} className={`leaderboard-item ${isCurrentGlobal ? 'active' : ''}`}>
                          <div className="leaderboard-left">
                            <span className="rank">#{index + 1}</span>
                            <div>
                              <p className="player-name">{player.display_name}</p>
                              <div className="subline">
                                {isCurrentGlobal ? <span className="mini-pill alt">You</span> : null}
                                <span>{player.sessions} session{player.sessions === 1 ? '' : 's'}</span>
                                <span>{player.water_count} water</span>
                              </div>
                            </div>
                          </div>
                          <div className="leaderboard-score">
                            <strong>{player.total_points ?? 0}</strong>
                            <small>pts</small>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
