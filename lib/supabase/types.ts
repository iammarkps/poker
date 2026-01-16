export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          host_session_id: string;
          status: "waiting" | "playing" | "finished";
          small_blind: number;
          big_blind: number;
          starting_chips: number;
          max_players: number;
          created_at: string;
          hand_count: number;
        };
        Insert: {
          id?: string;
          code: string;
          host_session_id: string;
          status?: "waiting" | "playing" | "finished";
          small_blind?: number;
          big_blind?: number;
          starting_chips?: number;
          max_players?: number;
          created_at?: string;
          hand_count?: number;
        };
        Update: {
          id?: string;
          code?: string;
          host_session_id?: string;
          status?: "waiting" | "playing" | "finished";
          small_blind?: number;
          big_blind?: number;
          starting_chips?: number;
          max_players?: number;
          created_at?: string;
          hand_count?: number;
        };
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          session_id: string;
          name: string;
          seat: number | null;
          chips: number;
          is_connected: boolean;
          time_bank: number;
        };
        Insert: {
          id?: string;
          room_id: string;
          session_id: string;
          name: string;
          seat?: number | null;
          chips: number;
          is_connected?: boolean;
          time_bank?: number;
        };
        Update: {
          id?: string;
          room_id?: string;
          session_id?: string;
          name?: string;
          seat?: number | null;
          chips?: number;
          is_connected?: boolean;
          time_bank?: number;
        };
      };
      hands: {
        Row: {
          id: string;
          room_id: string;
          dealer_seat: number;
          community_cards: string[];
          pot: number;
          current_bet: number;
          current_seat: number | null;
          phase: "preflop" | "flop" | "turn" | "river" | "showdown";
          deck: string[];
          version: number;
          last_raise: number;
          turn_start_time: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          dealer_seat: number;
          community_cards?: string[];
          pot?: number;
          current_bet?: number;
          current_seat?: number | null;
          phase?: "preflop" | "flop" | "turn" | "river" | "showdown";
          deck: string[];
          version?: number;
          last_raise?: number;
          turn_start_time?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          dealer_seat?: number;
          community_cards?: string[];
          pot?: number;
          current_bet?: number;
          current_seat?: number | null;
          phase?: "preflop" | "flop" | "turn" | "river" | "showdown";
          deck?: string[];
          version?: number;
          last_raise?: number;
          turn_start_time?: string | null;
        };
      };
      player_hands: {
        Row: {
          id: string;
          hand_id: string;
          player_id: string;
          hole_cards: string[];
          current_bet: number;
          total_contributed: number;
          has_acted: boolean;
          is_folded: boolean;
          is_all_in: boolean;
        };
        Insert: {
          id?: string;
          hand_id: string;
          player_id: string;
          hole_cards?: string[];
          current_bet?: number;
          total_contributed?: number;
          has_acted?: boolean;
          is_folded?: boolean;
          is_all_in?: boolean;
        };
        Update: {
          id?: string;
          hand_id?: string;
          player_id?: string;
          hole_cards?: string[];
          current_bet?: number;
          total_contributed?: number;
          has_acted?: boolean;
          is_folded?: boolean;
          is_all_in?: boolean;
        };
      };
      actions: {
        Row: {
          id: string;
          hand_id: string;
          player_id: string | null;
          action: "fold" | "check" | "call" | "raise" | "all_in";
          amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hand_id: string;
          player_id?: string | null;
          action: "fold" | "check" | "call" | "raise" | "all_in";
          amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          hand_id?: string;
          player_id?: string | null;
          action?: "fold" | "check" | "call" | "raise" | "all_in";
          amount?: number | null;
          created_at?: string;
        };
      };
    };
  };
};

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Hand = Database["public"]["Tables"]["hands"]["Row"];
export type PlayerHand = Database["public"]["Tables"]["player_hands"]["Row"];
export type Action = Database["public"]["Tables"]["actions"]["Row"];

export interface AddonRequest {
  id: string;
  room_id: string;
  player_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
