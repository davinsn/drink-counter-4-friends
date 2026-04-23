export type DrinkType = 'beer' | 'shot' | 'cocktail' | 'water';

export type Room = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  is_active: boolean;
  host_member_id: string | null;
};

export type Player = {
  id: string;
  device_key: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  player_id: string;
  role: 'host' | 'member';
  total_drinks: number;
  water_count: number;
  total_points: number;
  joined_at: string;
  players: Pick<Player, 'id' | 'display_name'> | null;
};

export type DrinkEvent = {
  id: string;
  room_id: string;
  member_id: string;
  actor_name: string;
  drink_type: DrinkType;
  delta: number;
  points: number;
  created_at: string;
};