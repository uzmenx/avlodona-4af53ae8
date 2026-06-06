export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          media_url: string | null
          role: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          media_url?: string | null
          role?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          media_url?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          caller_id: string
          created_at: string
          ended_at: string | null
          id: string
          receiver_id: string
          room_name: string
          room_url: string
          status: string
        }
        Insert: {
          caller_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          receiver_id: string
          room_name: string
          room_url: string
          status?: string
        }
        Update: {
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          receiver_id?: string
          room_name?: string
          room_url?: string
          status?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          media_type: string | null
          media_url: string | null
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_content: string | null
          last_message_sender_id: string | null
          last_message_status: string | null
          participant1_id: string
          participant2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_status?: string | null
          participant1_id: string
          participant2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_status?: string | null
          participant1_id?: string
          participant2_id?: string
        }
        Relationships: []
      }
      email_otp_codes: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          verified?: boolean
        }
        Relationships: []
      }
      family_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          member_id: string | null
          notify: boolean
          owner_id: string
          recurring: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          member_id?: string | null
          notify?: boolean
          owner_id: string
          recurring?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          member_id?: string | null
          notify?: boolean
          owner_id?: string
          recurring?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invitations: {
        Row: {
          created_at: string
          id: string
          member_id: string
          receiver_id: string
          relation_type: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          receiver_id: string
          relation_type: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          receiver_id?: string
          relation_type?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          relation_type: string | null
          status: string | null
          token: string
          tree_node_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          relation_type?: string | null
          status?: string | null
          token?: string
          tree_node_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          relation_type?: string | null
          status?: string | null
          token?: string
          tree_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_networks: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      family_tree_members: {
        Row: {
          avatar_url: string | null
          birth_year: number | null
          cover_url: string | null
          created_at: string
          death_year: number | null
          gender: string | null
          id: string
          is_placeholder: boolean
          linked_user_id: string | null
          member_name: string
          merged_into: string | null
          owner_id: string
          relation_type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_year?: number | null
          cover_url?: string | null
          created_at?: string
          death_year?: number | null
          gender?: string | null
          id?: string
          is_placeholder?: boolean
          linked_user_id?: string | null
          member_name: string
          merged_into?: string | null
          owner_id: string
          relation_type: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_year?: number | null
          cover_url?: string | null
          created_at?: string
          death_year?: number | null
          gender?: string | null
          id?: string
          is_placeholder?: boolean
          linked_user_id?: string | null
          member_name?: string
          merged_into?: string | null
          owner_id?: string
          relation_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_tree_members_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      global_node_positions: {
        Row: {
          id: string
          node_id: string
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          id?: string
          node_id: string
          updated_at?: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          id?: string
          node_id?: string
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "global_node_positions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "global_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      global_nodes: {
        Row: {
          bio: string | null
          birth_year: number | null
          claimed_by_user_id: string | null
          created_at: string
          created_by: string | null
          death_year: number | null
          father_id: string | null
          gender: string
          id: string
          is_public: boolean
          mother_id: string | null
          name: string
          photo_url: string | null
          spouse_id: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birth_year?: number | null
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          death_year?: number | null
          father_id?: string | null
          gender?: string
          id?: string
          is_public?: boolean
          mother_id?: string | null
          name?: string
          photo_url?: string | null
          spouse_id?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birth_year?: number | null
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          death_year?: number | null
          father_id?: string | null
          gender?: string
          id?: string
          is_public?: boolean
          mother_id?: string | null
          name?: string
          photo_url?: string | null
          spouse_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_nodes_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "global_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_nodes_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "global_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_nodes_spouse_id_fkey"
            columns: ["spouse_id"]
            isOneToOne: false
            referencedRelation: "global_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chats: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_link: string | null
          last_message_at: string | null
          last_message_content: string | null
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["chat_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["chat_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_link?: string | null
          last_message_at?: string | null
          last_message_content?: string | null
          name: string
          owner_id: string
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["chat_visibility"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_link?: string | null
          last_message_at?: string | null
          last_message_content?: string | null
          name?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["chat_visibility"]
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          media_type: string | null
          media_url: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      media_hashes: {
        Row: {
          created_at: string
          file_hash: string
          file_size: number | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_hash: string
          file_size?: number | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string
          file_size?: number | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      media_registry: {
        Row: {
          created_at: string
          file_size: number
          hash: string
          mime_type: string
          url: string
        }
        Insert: {
          created_at?: string
          file_size?: number
          hash: string
          mime_type?: string
          url: string
        }
        Update: {
          created_at?: string
          file_size?: number
          hash?: string
          mime_type?: string
          url?: string
        }
        Relationships: []
      }
      memorial_post_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorial_post_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "memorial_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      memorial_post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          memorial_post_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          memorial_post_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          memorial_post_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorial_post_comments_memorial_post_id_fkey"
            columns: ["memorial_post_id"]
            isOneToOne: false
            referencedRelation: "memorial_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorial_post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "memorial_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      memorial_post_likes: {
        Row: {
          created_at: string | null
          id: string
          memorial_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          memorial_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          memorial_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorial_post_likes_memorial_post_id_fkey"
            columns: ["memorial_post_id"]
            isOneToOne: false
            referencedRelation: "memorial_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      memorial_post_saves: {
        Row: {
          created_at: string | null
          id: string
          memorial_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          memorial_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          memorial_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorial_post_saves_memorial_post_id_fkey"
            columns: ["memorial_post_id"]
            isOneToOne: false
            referencedRelation: "memorial_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      memorial_post_views: {
        Row: {
          created_at: string | null
          id: string
          memorial_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          memorial_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          memorial_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorial_post_views_memorial_post_id_fkey"
            columns: ["memorial_post_id"]
            isOneToOne: false
            referencedRelation: "memorial_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      memorial_posts: {
        Row: {
          caption: string | null
          comments_count: number | null
          created_at: string | null
          created_by: string
          family_member_id: string
          id: string
          likes_count: number | null
          media_type: string
          media_url: string
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          created_by: string
          family_member_id: string
          id?: string
          likes_count?: number | null
          media_type: string
          media_url: string
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          created_by?: string
          family_member_id?: string
          id?: string
          likes_count?: number | null
          media_type?: string
          media_url?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memorial_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_listened: boolean | null
          media_type: string | null
          media_url: string | null
          sender_id: string
          status: string
          updated_at: string
          waveform_data: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_listened?: boolean | null
          media_type?: string | null
          media_url?: string | null
          sender_id: string
          status?: string
          updated_at?: string
          waveform_data?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_listened?: boolean | null
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      node_positions: {
        Row: {
          id: string
          member_id: string
          network_id: string
          owner_id: string
          updated_at: string
          updated_by: string | null
          x: number
          y: number
        }
        Insert: {
          id?: string
          member_id: string
          network_id: string
          owner_id: string
          updated_at?: string
          updated_by?: string | null
          x?: number
          y?: number
        }
        Update: {
          id?: string
          member_id?: string
          network_id?: string
          owner_id?: string
          updated_at?: string
          updated_by?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "node_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_positions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "family_networks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message_id: string | null
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otp_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          phone_number: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          phone_number: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          phone_number?: string
          verified?: boolean
        }
        Relationships: []
      }
      post_collabs: {
        Row: {
          created_at: string
          id: string
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_collabs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          post_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          post_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "post_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_collection_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_collections: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string
          family_member_id: string | null
          id: string
          mentioned_user_id: string | null
          post_id: string
        }
        Insert: {
          created_at?: string
          family_member_id?: string | null
          id?: string
          mentioned_user_id?: string | null
          post_id: string
        }
        Update: {
          created_at?: string
          family_member_id?: string | null
          id?: string
          mentioned_user_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audio_artist: string | null
          audio_title: string | null
          audio_url: string | null
          comments_count: number | null
          content: string | null
          created_at: string
          id: string
          likes_count: number | null
          media_metadata: Json | null
          media_urls: string[] | null
          target_member_id: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          views_count: number | null
          visibility: string
        }
        Insert: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number | null
          media_metadata?: Json | null
          media_urls?: string[] | null
          target_member_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          views_count?: number | null
          visibility?: string
        }
        Update: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number | null
          media_metadata?: Json | null
          media_urls?: string[] | null
          target_member_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bg_theme: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          family_network_id: string | null
          gender: string | null
          hide_collections: boolean
          hide_highlights: boolean
          hide_mentions: boolean
          hide_online_status: boolean
          hide_saved_posts: boolean
          id: string
          is_private: boolean
          last_image_gen_at: string | null
          last_seen: string | null
          my_node_id: string | null
          name: string | null
          social_links: Json | null
          subscription_tier: string | null
          theme_mode: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bg_theme?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          family_network_id?: string | null
          gender?: string | null
          hide_collections?: boolean
          hide_highlights?: boolean
          hide_mentions?: boolean
          hide_online_status?: boolean
          hide_saved_posts?: boolean
          id: string
          is_private?: boolean
          last_image_gen_at?: string | null
          last_seen?: string | null
          my_node_id?: string | null
          name?: string | null
          social_links?: Json | null
          subscription_tier?: string | null
          theme_mode?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bg_theme?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          family_network_id?: string | null
          gender?: string | null
          hide_collections?: boolean
          hide_highlights?: boolean
          hide_mentions?: boolean
          hide_online_status?: boolean
          hide_saved_posts?: boolean
          id?: string
          is_private?: boolean
          last_image_gen_at?: string | null
          last_seen?: string | null
          my_node_id?: string | null
          name?: string | null
          social_links?: Json | null
          subscription_tier?: string | null
          theme_mode?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_network_id_fkey"
            columns: ["family_network_id"]
            isOneToOne: false
            referencedRelation: "family_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_my_node_id_fkey"
            columns: ["my_node_id"]
            isOneToOne: false
            referencedRelation: "global_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          reporter_id: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_tracks: {
        Row: {
          audio_artist: string | null
          audio_title: string | null
          audio_url: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      shorts_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          next_page_token: string | null
          shorts: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          next_page_token?: string | null
          shorts?: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          next_page_token?: string | null
          shorts?: Json
        }
        Relationships: []
      }
      stories: {
        Row: {
          audio_artist: string | null
          audio_title: string | null
          audio_url: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_metadata: Json | null
          media_type: string
          media_url: string
          ring_id: string
          user_id: string
        }
        Insert: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_metadata?: Json | null
          media_type?: string
          media_url: string
          ring_id?: string
          user_id: string
        }
        Update: {
          audio_artist?: string | null
          audio_title?: string | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_metadata?: Json | null
          media_type?: string
          media_url?: string
          ring_id?: string
          user_id?: string
        }
        Relationships: []
      }
      story_highlight_items: {
        Row: {
          caption: string | null
          created_at: string
          highlight_id: string
          id: string
          media_type: string
          media_url: string
          sort_order: number
          story_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          highlight_id: string
          id?: string
          media_type?: string
          media_url: string
          sort_order?: number
          story_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          highlight_id?: string
          id?: string
          media_type?: string
          media_url?: string
          sort_order?: number
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_highlight_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "story_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_highlight_items_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_highlights: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      tree_post_likes: {
        Row: {
          created_at: string
          id: string
          tree_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tree_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tree_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tree_post_likes_tree_post_id_fkey"
            columns: ["tree_post_id"]
            isOneToOne: false
            referencedRelation: "tree_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tree_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_personal: boolean
          is_published: boolean
          overlays: Json
          positions_data: Json
          title: string | null
          tree_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_personal?: boolean
          is_published?: boolean
          overlays?: Json
          positions_data?: Json
          title?: string | null
          tree_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_personal?: boolean
          is_published?: boolean
          overlays?: Json
          positions_data?: Json
          title?: string | null
          tree_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          is_typing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      unfollow_history: {
        Row: {
          created_at: string
          id: string
          unfollowed_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unfollowed_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unfollowed_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          ai_chat_count_daily: number | null
          ai_image_count_daily: number | null
          last_image_gen_at: string | null
          last_reset_date: string | null
          total_storage_bytes: number | null
          user_id: string
        }
        Insert: {
          ai_chat_count_daily?: number | null
          ai_image_count_daily?: number | null
          last_image_gen_at?: string | null
          last_reset_date?: string | null
          total_storage_bytes?: number | null
          user_id: string
        }
        Update: {
          ai_chat_count_daily?: number | null
          ai_image_count_daily?: number | null
          last_image_gen_at?: string | null
          last_reset_date?: string | null
          total_storage_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_chat: { Args: { p_user_id: string }; Returns: Json }
      check_and_increment_image: { Args: { p_user_id: string }; Returns: Json }
      get_group_invite_preview: {
        Args: { invite: string }
        Returns: {
          avatar_url: string
          description: string
          id: string
          invite_link: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["chat_type"]
          visibility: Database["public"]["Enums"]["chat_visibility"]
        }[]
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner_or_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_via_invite: { Args: { invite_str: string }; Returns: boolean }
      reset_daily_usage: { Args: never; Returns: undefined }
    }
    Enums: {
      chat_type: "group" | "channel"
      chat_visibility: "public" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chat_type: ["group", "channel"],
      chat_visibility: ["public", "private"],
    },
  },
} as const
