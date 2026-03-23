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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          call_type: string | null
          callee_id: string
          caller_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          room_name: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          call_type?: string | null
          callee_id: string
          caller_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          room_name?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          call_type?: string | null
          callee_id?: string
          caller_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          room_name?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
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
          likes_count: number | null
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string | null
          id: string
          last_message_at: string | null
          participant1_id: string
          participant2_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant1_id: string
          participant2_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant1_id?: string
          participant2_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_otp_codes: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_hash: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      family_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          is_recurring: boolean | null
          member_id: string | null
          notify: boolean | null
          owner_id: string
          recurring: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          member_id?: string | null
          notify?: boolean | null
          owner_id: string
          recurring?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          member_id?: string | null
          notify?: boolean | null
          owner_id?: string
          recurring?: boolean | null
          title?: string
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
          created_at: string | null
          id: string
          member_id: string | null
          receiver_id: string
          relation_type: string
          sender_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          receiver_id: string
          relation_type: string
          sender_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          receiver_id?: string
          relation_type?: string
          sender_id?: string
          status?: string | null
          updated_at?: string | null
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
      family_networks: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      family_tree_members: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          gender: string | null
          id: string
          is_placeholder: boolean | null
          linked_user_id: string | null
          member_name: string
          merged_into: string | null
          owner_id: string
          relation_type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_placeholder?: boolean | null
          linked_user_id?: string | null
          member_name: string
          merged_into?: string | null
          owner_id: string
          relation_type: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_placeholder?: boolean | null
          linked_user_id?: string | null
          member_name?: string
          merged_into?: string | null
          owner_id?: string
          relation_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      group_chats: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          invite_link: string | null
          last_message_at: string | null
          last_message_content: string | null
          name: string
          owner_id: string | null
          type: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          invite_link?: string | null
          last_message_at?: string | null
          last_message_content?: string | null
          name: string
          owner_id?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          invite_link?: string | null
          last_message_at?: string | null
          last_message_content?: string | null
          name?: string
          owner_id?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          joined_at: string | null
          last_read_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string | null
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
      group_messages: {
        Row: {
          content: string | null
          created_at: string | null
          group_id: string | null
          id: string
          is_forwarded: boolean | null
          media_type: string | null
          media_url: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_forwarded?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_forwarded?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          sender_id?: string
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
      likes: {
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
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      media_hashes: {
        Row: {
          created_at: string | null
          file_hash: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_hash: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_hash?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      memorial_posts: {
        Row: {
          caption: string | null
          created_at: string | null
          created_by: string
          family_member_id: string
          id: string
          media_type: string | null
          media_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          created_by: string
          family_member_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          created_by?: string
          family_member_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memorial_posts_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_forwarded: boolean | null
          media_type: string | null
          media_url: string | null
          read: boolean | null
          reply_to: string | null
          sender_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_forwarded?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read?: boolean | null
          reply_to?: string | null
          sender_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_forwarded?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read?: boolean | null
          reply_to?: string | null
          sender_id?: string
          status?: string | null
          updated_at?: string | null
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
          created_at: string | null
          id: string
          member_id: string
          owner_id: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          x: number | null
          y: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          owner_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          x?: number | null
          y?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          owner_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          x?: number | null
          y?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message_id: string | null
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string | null
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string | null
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_collabs: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_collection_items: {
        Row: {
          collection_id: string | null
          created_at: string | null
          id: string
          post_id: string
          sort_order: number | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          post_id: string
          sort_order?: number | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "post_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      post_collections: {
        Row: {
          cover_url: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          theme: number | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          theme?: number | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          theme?: number | null
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_mentions: {
        Row: {
          created_at: string | null
          family_member_id: string | null
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: []
      }
      post_views: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number | null
          media_urls: string[] | null
          target_member_id: string | null
          user_id: string
          views_count: number | null
          visibility: string | null
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          media_urls?: string[] | null
          target_member_id?: string | null
          user_id: string
          views_count?: number | null
          visibility?: string | null
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          media_urls?: string[] | null
          target_member_id?: string | null
          user_id?: string
          views_count?: number | null
          visibility?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          family_network_id: string | null
          full_name: string | null
          gender: string | null
          hide_collections: boolean | null
          hide_highlights: boolean | null
          hide_mentions: boolean | null
          hide_online_status: boolean | null
          hide_saved_posts: boolean | null
          is_private: boolean | null
          id: string
          instagram: string | null
          last_seen: string | null
          name: string | null
          social_links: Json | null
          telegram: string | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          family_network_id?: string | null
          full_name?: string | null
          gender?: string | null
          hide_collections?: boolean | null
          hide_highlights?: boolean | null
          hide_mentions?: boolean | null
          hide_online_status?: boolean | null
          hide_saved_posts?: boolean | null
          is_private?: boolean | null
          id?: string
          instagram?: string | null
          last_seen?: string | null
          name?: string | null
          social_links?: Json | null
          telegram?: string | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          family_network_id?: string | null
          full_name?: string | null
          gender?: string | null
          hide_collections?: boolean | null
          hide_highlights?: boolean | null
          hide_mentions?: boolean | null
          hide_online_status?: boolean | null
          hide_saved_posts?: boolean | null
          is_private?: boolean | null
          id?: string
          instagram?: string | null
          last_seen?: string | null
          name?: string | null
          social_links?: Json | null
          telegram?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          media_type: string | null
          media_url: string
          ring_id: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url: string
          ring_id?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string
          ring_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_highlight_items: {
        Row: {
          caption: string | null
          created_at: string | null
          highlight_id: string | null
          id: string
          media_type: string | null
          media_url: string
          sort_order: number | null
          story_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          media_type?: string | null
          media_url: string
          sort_order?: number | null
          story_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string
          sort_order?: number | null
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
        ]
      }
      story_highlights: {
        Row: {
          cover_url: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string | null
          id: string
          story_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          story_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          story_id?: string | null
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
          story_id: string | null
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
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
          created_at: string | null
          id: string
          tree_post_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tree_post_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tree_post_id?: string | null
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
          created_at: string | null
          id: string
          is_personal: boolean | null
          is_published: boolean | null
          overlays: Json | null
          positions_data: Json | null
          title: string
          tree_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_personal?: boolean | null
          is_published?: boolean | null
          overlays?: Json | null
          positions_data?: Json | null
          title: string
          tree_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_personal?: boolean | null
          is_published?: boolean | null
          overlays?: Json | null
          positions_data?: Json | null
          title?: string
          tree_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string | null
          id: string
          is_typing: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
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
          created_at: string | null
          id: string
          unfollowed_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          unfollowed_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          unfollowed_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
