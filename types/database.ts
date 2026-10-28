export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_images": {
                  Row: {
                    "alt_text": string,"caption": string | null,"created_at": string,"id": string,"image_key": string,"is_active": boolean,"order_index": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text": string,"caption"?: string | null,"created_at"?: string,"id"?: string,"image_key": string,"is_active"?: boolean,"order_index"?: number | null
                  }
                  Update: {
                    "alt_text"?: string,"caption"?: string | null,"created_at"?: string,"id"?: string,"image_key"?: string,"is_active"?: boolean,"order_index"?: number | null
                  }
                  Relationships: []
                },"banners": {
                  Row: {
                    "advertiser_name": string | null,"alt_text": string,"click_count": number,"created_at": string,"id": string,"image_key": string,"image_key_mobile": string | null,"is_active": boolean,"link_url": string,"name": string,"open_in_new_tab": boolean,"placements": string[],"priority": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertiser_name"?: string | null,"alt_text": string,"click_count"?: number,"created_at"?: string,"id"?: string,"image_key": string,"image_key_mobile"?: string | null,"is_active"?: boolean,"link_url": string,"name": string,"open_in_new_tab"?: boolean,"placements": string[],"priority"?: number,"updated_at"?: string
                  }
                  Update: {
                    "advertiser_name"?: string | null,"alt_text"?: string,"click_count"?: number,"created_at"?: string,"id"?: string,"image_key"?: string,"image_key_mobile"?: string | null,"is_active"?: boolean,"link_url"?: string,"name"?: string,"open_in_new_tab"?: boolean,"placements"?: string[],"priority"?: number,"updated_at"?: string
                  }
                  Relationships: []
                },"courses": {
                  Row: {
                    "category_id": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"duration_minutes": number | null,"id": string,"is_coming_soon": boolean,"lesson_count": number | null,"level": string | null,"locale": string,"price_cents": number | null,"pricing_type": string,"promo_youtube_id": string | null,"search_vector": string | null,"slug": string,"status": string,"thumbnail_key": string | null,"title": string,"translation_group_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_coming_soon"?: boolean,"lesson_count"?: number | null,"level"?: string | null,"locale"?: string,"price_cents"?: number | null,"pricing_type"?: string,"promo_youtube_id"?: string | null,"search_vector"?: string | null,"slug": string,"status"?: string,"thumbnail_key"?: string | null,"title": string,"translation_group_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_coming_soon"?: boolean,"lesson_count"?: number | null,"level"?: string | null,"locale"?: string,"price_cents"?: number | null,"pricing_type"?: string,"promo_youtube_id"?: string | null,"search_vector"?: string | null,"slug"?: string,"status"?: string,"thumbnail_key"?: string | null,"title"?: string,"translation_group_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"trainers": {
                  Row: {
                    "bio": string | null,"created_at": string,"email": string | null,"experience": string | null,"id": string,"is_active": boolean,"name": string,"order_index": number | null,"phone": string | null,"photo_key": string | null,"position": string,"qualifications": string | null,"search_vector": string | null,"slug": string,"updated_at": string,"whatsapp_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"email"?: string | null,"experience"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"order_index"?: number | null,"phone"?: string | null,"photo_key"?: string | null,"position": string,"qualifications"?: string | null,"search_vector"?: string | null,"slug": string,"updated_at"?: string,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"email"?: string | null,"experience"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"order_index"?: number | null,"phone"?: string | null,"photo_key"?: string | null,"position"?: string,"qualifications"?: string | null,"search_vector"?: string | null,"slug"?: string,"updated_at"?: string,"whatsapp_number"?: string | null
                  }
                  Relationships: []
                },"article_comments": {
                  Row: {
                    "article_id": string,"body": string,"created_at": string,"id": string,"moderated_at": string | null,"moderated_by": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "article_id": string,"body": string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "article_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "article_comments_article_id_fkey"
      columns: ["article_id"]
isOneToOne: false
      referencedRelation: "articles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "article_comments_moderated_by_fkey"
      columns: ["moderated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "article_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"article_likes": {
                  Row: {
                    "article_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "article_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "article_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "article_likes_article_id_fkey"
      columns: ["article_id"]
isOneToOne: false
      referencedRelation: "articles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "article_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"article_refs": {
                  Row: {
                    "article_id": string,"created_at": string,"id": string,"node_id": string,"phrase": string | null,"ref_id": string,"ref_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "article_id": string,"created_at"?: string,"id"?: string,"node_id": string,"phrase"?: string | null,"ref_id": string,"ref_type": string
                  }
                  Update: {
                    "article_id"?: string,"created_at"?: string,"id"?: string,"node_id"?: string,"phrase"?: string | null,"ref_id"?: string,"ref_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "article_refs_article_id_fkey"
      columns: ["article_id"]
isOneToOne: false
      referencedRelation: "articles"
      referencedColumns: ["id"]
    }
                  ]
                },"articles": {
                  Row: {
                    "author_id": string | null,"body": NonNullable<Json>,"body_text": string,"body_version": number,"category_id": string | null,"comment_count": number,"cover_image_alt": string | null,"cover_image_key": string | null,"created_at": string,"deleted_at": string | null,"excerpt": string | null,"id": string,"like_count": number,"locale": string,"published_at": string | null,"search_vector": unknown,"seo_description": string | null,"seo_title": string | null,"slug": string,"status": string,"title": string,"translation_group_id": string | null,"updated_at": string,"view_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: NonNullable<Json>,"body_text"?: string,"body_version"?: number,"category_id"?: string | null,"comment_count"?: number,"cover_image_alt"?: string | null,"cover_image_key"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"excerpt"?: string | null,"id"?: string,"like_count"?: number,"locale"?: string,"published_at"?: string | null,"search_vector"?: unknown,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"status"?: string,"title": string,"translation_group_id"?: string | null,"updated_at"?: string,"view_count"?: number
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: NonNullable<Json>,"body_text"?: string,"body_version"?: number,"category_id"?: string | null,"comment_count"?: number,"cover_image_alt"?: string | null,"cover_image_key"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"excerpt"?: string | null,"id"?: string,"like_count"?: number,"locale"?: string,"published_at"?: string | null,"search_vector"?: unknown,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"status"?: string,"title"?: string,"translation_group_id"?: string | null,"updated_at"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "articles_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "authors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "articles_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"authors": {
                  Row: {
                    "bio": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"order_index": number,"photo_key": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"order_index"?: number,"photo_key"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"order_index"?: number,"photo_key"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "applies_to": (string)[],"created_at": string,"id": string,"name": string,"name_i18n": NonNullable<Json>,"order_index": number,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applies_to"?: (string)[],"created_at"?: string,"id"?: string,"name": string,"name_i18n"?: NonNullable<Json>,"order_index"?: number,"slug": string
                  }
                  Update: {
                    "applies_to"?: (string)[],"created_at"?: string,"id"?: string,"name"?: string,"name_i18n"?: NonNullable<Json>,"order_index"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"media_assets": {
                  Row: {
                    "alt_text": string | null,"bucket": string,"created_at": string,"file_key": string,"height": number | null,"id": string,"kind": string,"mime_type": string | null,"size_bytes": number | null,"status": string,"uploaded_by": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"bucket": string,"created_at"?: string,"file_key": string,"height"?: number | null,"id"?: string,"kind": string,"mime_type"?: string | null,"size_bytes"?: number | null,"status"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string | null,"bucket"?: string,"created_at"?: string,"file_key"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"mime_type"?: string | null,"size_bytes"?: number | null,"status"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"page_revisions": {
                  Row: {
                    "body": Json | null,"id": string,"page_id": string,"published_at": string | null,"published_by": string | null,"title": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: Json | null,"id"?: string,"page_id": string,"published_at"?: string | null,"published_by"?: string | null,"title"?: string | null,"version": number
                  }
                  Update: {
                    "body"?: Json | null,"id"?: string,"page_id"?: string,"published_at"?: string | null,"published_by"?: string | null,"title"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_revisions_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pages": {
                  Row: {
                    "body": Json | null,"created_at": string,"id": string,"locale": string,"slug": string,"title": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: Json | null,"created_at"?: string,"id"?: string,"locale"?: string,"slug": string,"title": string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "body"?: Json | null,"created_at"?: string,"id"?: string,"locale"?: string,"slug"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"billing_address": Json | null,"company_name": string | null,"created_at": string,"deleted_at": string | null,"display_name": string,"email": string,"first_name": string | null,"id": string,"idle_warning_sent_at": string | null,"last_name": string | null,"locale": string,"phone": string | null,"status": string,"suspended_reason": string | null,"tax_id": string | null,"terms_accepted_at": string | null,"terms_revision_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"billing_address"?: Json | null,"company_name"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"email": string,"first_name"?: string | null,"id": string,"idle_warning_sent_at"?: string | null,"last_name"?: string | null,"locale"?: string,"phone"?: string | null,"status"?: string,"suspended_reason"?: string | null,"tax_id"?: string | null,"terms_accepted_at"?: string | null,"terms_revision_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"billing_address"?: Json | null,"company_name"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"email"?: string,"first_name"?: string | null,"id"?: string,"idle_warning_sent_at"?: string | null,"last_name"?: string | null,"locale"?: string,"phone"?: string | null,"status"?: string,"suspended_reason"?: string | null,"tax_id"?: string | null,"terms_accepted_at"?: string | null,"terms_revision_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_terms_revision_id_fkey"
      columns: ["terms_revision_id"]
isOneToOne: false
      referencedRelation: "page_revisions"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "action": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"role": string
                  }
                  Update: {
                    "action"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "is_public": boolean,"key": string,"setting_group": string,"updated_at": string,"updated_by": string | null,"value": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "is_public"?: boolean,"key": string,"setting_group": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: Json | null
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"setting_group"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"slug_redirects": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": string,"id": string,"locale": string | null,"old_slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": string,"id"?: string,"locale"?: string | null,"old_slug": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"locale"?: string | null,"old_slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_comments": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"moderated_at": string | null,"moderated_by": string | null,"status": string,"updated_at": string,"user_id": string,"video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string,"video_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string,"video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_comments_moderated_by_fkey"
      columns: ["moderated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_comments_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                },"video_likes": {
                  Row: {
                    "created_at": string,"user_id": string,"video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string,"video_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string,"video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_likes_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                },"videos": {
                  Row: {
                    "category_id": string | null,"comment_count": number,"created_at": string,"deleted_at": string | null,"description": string | null,"duration_seconds": number | null,"id": string,"like_count": number,"locale": string,"published_at": string | null,"search_vector": unknown,"status": string,"thumbnail_key": string,"thumbnail_source": string,"title": string,"translation_group_id": string | null,"updated_at": string,"youtube_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_seconds"?: number | null,"id"?: string,"like_count"?: number,"locale"?: string,"published_at"?: string | null,"search_vector"?: unknown,"status"?: string,"thumbnail_key": string,"thumbnail_source"?: string,"title": string,"translation_group_id"?: string | null,"updated_at"?: string,"youtube_id": string
                  }
                  Update: {
                    "category_id"?: string | null,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_seconds"?: number | null,"id"?: string,"like_count"?: number,"locale"?: string,"published_at"?: string | null,"search_vector"?: unknown,"status"?: string,"thumbnail_key"?: string,"thumbnail_source"?: string,"title"?: string,"translation_group_id"?: string | null,"updated_at"?: string,"youtube_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "videos_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "pg_all_foreign_keys": {
                  Row: {
                    "fk_columns": (unknown)[] | null,"fk_constraint_name": unknown,"fk_schema_name": unknown,"fk_table_name": unknown,"fk_table_oid": unknown,"is_deferrable": boolean | null,"is_deferred": boolean | null,"match_type": string | null,"on_delete": string | null,"on_update": string | null,"pk_columns": (unknown)[] | null,"pk_constraint_name": unknown,"pk_index_name": unknown,"pk_schema_name": unknown,"pk_table_name": unknown,"pk_table_oid": unknown
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"tap_funky": {
                  Row: {
                    "args": string | null,"is_definer": boolean | null,"is_strict": boolean | null,"is_visible": boolean | null,"kind": unknown,"langoid": unknown,"name": unknown,"oid": unknown,"owner": unknown,"returns": string | null,"returns_set": boolean | null,"schema": unknown,"volatility": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_cleanup":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"_contract_on":
{ Args: { "": string }; Returns: unknown
                           },
"_currtest":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"_db_privs":
{ Args: Record<PropertyKey, never>; Returns: (unknown)[]
                           },
"_extensions":
{ Args: Record<PropertyKey, never>; Returns: unknown[]
                           },
"_get":
{ Args: { "": string }; Returns: number
                           },
"_get_latest":
{ Args: { "": string }; Returns: (number)[]
                           },
"_get_note":
{ Args: { "": string }; Returns: string
                           },
"_is_verbose":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"_prokind":
{ Args: { "p_oid": unknown }; Returns: unknown
                           },
"_query":
{ Args: { "": string }; Returns: string
                           },
"_refine_vol":
{ Args: { "": string }; Returns: string
                           },
"_retval":
{ Args: { "": string }; Returns: string
                           },
"_table_privs":
{ Args: Record<PropertyKey, never>; Returns: (unknown)[]
                           },
"_temptypes":
{ Args: { "": string }; Returns: string
                           },
"_todo":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"col_is_null":
{ Args: { "column_name": unknown,"description"?: string,"schema_name": unknown,"table_name": unknown }; Returns: string
                           } |
{ Args: { "column_name": unknown,"description"?: string,"table_name": unknown }; Returns: string
                           },
"col_not_null":
{ Args: { "column_name": unknown,"description"?: string,"schema_name": unknown,"table_name": unknown }; Returns: string
                           } |
{ Args: { "column_name": unknown,"description"?: string,"table_name": unknown }; Returns: string
                           },
"create_profile_for":
{ Args: { "p_user": unknown }; Returns: undefined
                           },
"diag":
{ Args: { "msg": unknown }; Returns: { error: true } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
                           } |
{ Args: { "msg": string }; Returns: { error: true } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
                           },
"diag_test_name":
{ Args: { "": string }; Returns: string
                           },
"do_tap":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           } |
{ Args: { "": string }; Returns: string[]
                           },
"fail":
{ Args: Record<PropertyKey, never>; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           },
"findfuncs":
{ Args: { "": string }; Returns: (string)[]
                           },
"finish":
{ Args: { "exception_on_failure"?: boolean }; Returns: string[]
                           },
"format_type_string":
{ Args: { "": string }; Returns: string
                           },
"has_permission":
{ Args: { "p_action": string }; Returns: boolean
                           },
"has_unique":
{ Args: { "": string }; Returns: string
                           },
"in_todo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_empty":
{ Args: { "": string }; Returns: string
                           },
"is_staff_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"isnt_empty":
{ Args: { "": string }; Returns: string
                           },
"lives_ok":
{ Args: { "": string }; Returns: string
                           },
"no_plan":
{ Args: Record<PropertyKey, never>; Returns: boolean[]
                           },
"num_failed":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"os_name":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pass":
{ Args: Record<PropertyKey, never>; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           },
"pg_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pg_version_num":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"pgtap_version":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"profile_is_super_admin":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"runtests":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           } |
{ Args: { "": string }; Returns: string[]
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"skip":
{ Args: { "": string }; Returns: string
                           } |
{ Args: { "how_many": number,"why": string }; Returns: string
                           },
"throws_ok":
{ Args: { "": string }; Returns: string
                           },
"todo":
{ Args: { "how_many": number }; Returns: boolean[]
                           } |
{ Args: { "how_many": number,"why": string }; Returns: boolean[]
                           } |
{ Args: { "why": string }; Returns: boolean[]
                           } |
{ Args: { "how_many": number,"why": string }; Returns: boolean[]
                           },
"todo_end":
{ Args: Record<PropertyKey, never>; Returns: boolean[]
                           },
"todo_start":
{ Args: Record<PropertyKey, never>; Returns: boolean[]
                           } |
{ Args: { "": string }; Returns: boolean[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "_time_trial_type": {
                        "a_time": number | null
                      }
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
