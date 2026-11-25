// Mirrors the output of `npm run db:types`. Regenerate after changing migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      destinations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          country: string;
          region: string;
          cover_url: string | null;
          description: string | null;
          lat: number;
          lng: number;
          popularity: number;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          country: string;
          region: string;
          cover_url?: string | null;
          description?: string | null;
          lat: number;
          lng: number;
          popularity?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["destinations"]["Insert"]>;
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          destination_id: string;
          name: string;
          category: Database["public"]["Enums"]["place_category"];
          description: string | null;
          address: string | null;
          lat: number;
          lng: number;
          photo_url: string | null;
          rating: number | null;
          external_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          destination_id: string;
          name: string;
          category: Database["public"]["Enums"]["place_category"];
          description?: string | null;
          address?: string | null;
          lat: number;
          lng: number;
          photo_url?: string | null;
          rating?: number | null;
          external_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["places"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "places_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          id: string;
          owner_id: string;
          destination_id: string | null;
          name: string;
          start_date: string;
          end_date: string;
          cover_url: string | null;
          visibility: Database["public"]["Enums"]["trip_visibility"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          destination_id?: string | null;
          name: string;
          start_date: string;
          end_date: string;
          cover_url?: string | null;
          visibility?: Database["public"]["Enums"]["trip_visibility"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "trips_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_members: {
        Row: {
          trip_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["trip_member_role"];
        } & Timestamps;
        Insert: {
          trip_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["trip_member_role"];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_blocks: {
        Row: {
          id: string;
          trip_id: string;
          type: Database["public"]["Enums"]["trip_block_type"];
          title: string | null;
          position: number;
          collapsed: boolean;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          type: Database["public"]["Enums"]["trip_block_type"];
          title?: string | null;
          position: number;
          collapsed?: boolean;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_blocks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "trip_blocks_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      itinerary_items: {
        Row: {
          id: string;
          trip_id: string;
          day_date: string;
          place_id: string | null;
          title: string | null;
          position: number;
          start_time: string | null;
          duration_minutes: number | null;
          notes: string | null;
          travel_mode: "driving" | "walking" | "cycling" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          day_date: string;
          place_id?: string | null;
          title?: string | null;
          position: number;
          start_time?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          travel_mode?: "driving" | "walking" | "cycling" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["itinerary_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "itinerary_items_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itinerary_items_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          trip_id: string;
          total: number;
          currency: string;
          updated_at: string;
        };
        Insert: {
          trip_id: string;
          total: number;
          currency?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "budgets_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          trip_id: string;
          amount: number;
          currency: string;
          category: Database["public"]["Enums"]["expense_category"];
          date: string;
          paid_by: string | null;
          note: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          trip_id: string;
          amount: number;
          currency: string;
          category?: Database["public"]["Enums"]["expense_category"];
          date?: string;
          paid_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          id: string;
          trip_id: string;
          author_id: string;
          entry_date: string;
          body: string;
          photos: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          author_id?: string;
          entry_date?: string;
          body?: string;
          photos?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "journal_entries_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entries_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guides: {
        Row: {
          id: string;
          author_id: string;
          destination_id: string | null;
          title: string;
          intro: string | null;
          cover_url: string | null;
          tags: string[];
          status: Database["public"]["Enums"]["guide_status"];
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          destination_id?: string | null;
          title: string;
          intro?: string | null;
          cover_url?: string | null;
          tags?: string[];
          status?: Database["public"]["Enums"]["guide_status"];
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guides"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guides_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guides_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_sections: {
        Row: {
          id: string;
          guide_id: string;
          title: string;
          position: number;
        } & Timestamps;
        Insert: {
          id?: string;
          guide_id: string;
          title: string;
          position: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guide_sections"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guide_sections_guide_id_fkey";
            columns: ["guide_id"];
            isOneToOne: false;
            referencedRelation: "guides";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_places: {
        Row: {
          id: string;
          section_id: string;
          place_id: string;
          position: number;
          note: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          section_id: string;
          place_id: string;
          position: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guide_places"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guide_places_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "guide_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guide_places_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_likes: {
        Row: { guide_id: string; user_id: string } & Timestamps;
        Insert: { guide_id: string; user_id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["guide_likes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guide_likes_guide_id_fkey";
            columns: ["guide_id"];
            isOneToOne: false;
            referencedRelation: "guides";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_saves: {
        Row: { guide_id: string; user_id: string } & Timestamps;
        Insert: { guide_id: string; user_id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["guide_saves"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "guide_saves_guide_id_fkey";
            columns: ["guide_id"];
            isOneToOne: false;
            referencedRelation: "guides";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      guide_cards: {
        Row: {
          id: string;
          title: string;
          intro: string | null;
          cover_url: string | null;
          tags: string[];
          status: Database["public"]["Enums"]["guide_status"];
          published_at: string | null;
          author_id: string;
          author_username: string;
          author_full_name: string | null;
          author_avatar_url: string | null;
          destination_id: string | null;
          destination_name: string | null;
          destination_slug: string | null;
          place_count: number;
          like_count: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      place_category:
        | "attraction"
        | "restaurant"
        | "fast_food"
        | "cafe"
        | "hotel"
        | "nightlife";
      trip_visibility: "private" | "shared";
      trip_member_role: "owner" | "editor" | "viewer";
      trip_block_type: "note" | "list" | "reservation";
      expense_category:
        | "flights"
        | "lodging"
        | "transport"
        | "food"
        | "activities"
        | "shopping"
        | "other";
      guide_status: "draft" | "published";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
