
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
                  Relationships: [
                    
                  ]
                },"admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string,"after": Json | null,"before": Json | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
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
      foreignKeyName: "article_comments_moderated_by_fkey"
      columns: ["moderated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "article_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "article_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
    },{
      foreignKeyName: "article_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
                },"bank_transfer_slips": {
                  Row: {
                    "file_key": string,"id": string,"mime_type": string | null,"order_id": string,"rejection_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"size_bytes": number | null,"status": string,"uploaded_at": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "file_key": string,"id"?: string,"mime_type"?: string | null,"order_id": string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes"?: number | null,"status"?: string,"uploaded_at"?: string,"uploaded_by": string
                  }
                  Update: {
                    "file_key"?: string,"id"?: string,"mime_type"?: string | null,"order_id"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes"?: number | null,"status"?: string,"uploaded_at"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_transfer_slips_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_slips_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_slips_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_slips_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_slips_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "advertiser_name": string | null,"alt_text": string,"click_count": number,"created_at": string,"id": string,"image_key": string,"image_key_mobile": string | null,"is_active": boolean,"link_url": string,"name": string,"open_in_new_tab": boolean,"placements": (string)[],"priority": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertiser_name"?: string | null,"alt_text": string,"click_count"?: number,"created_at"?: string,"id"?: string,"image_key": string,"image_key_mobile"?: string | null,"is_active"?: boolean,"link_url": string,"name": string,"open_in_new_tab"?: boolean,"placements": (string)[],"priority"?: number,"updated_at"?: string
                  }
                  Update: {
                    "advertiser_name"?: string | null,"alt_text"?: string,"click_count"?: number,"created_at"?: string,"id"?: string,"image_key"?: string,"image_key_mobile"?: string | null,"is_active"?: boolean,"link_url"?: string,"name"?: string,"open_in_new_tab"?: boolean,"placements"?: (string)[],"priority"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"document_id": string,"id": string,"language": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id": string,"id"?: string,"language": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string,"id"?: string,"language"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "report_top_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["user_id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "created_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
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
                },"coupon_uses": {
                  Row: {
                    "coupon_id": string,"id": string,"order_id": string,"released_at": string | null,"used_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"id"?: string,"order_id": string,"released_at"?: string | null,"used_at"?: string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"id"?: string,"order_id"?: string,"released_at"?: string | null,"used_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_uses_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_uses_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_uses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_uses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"discount_type": string,"discount_value": number,"expires_at": string,"id": string,"is_active": boolean,"max_uses": number,"max_uses_per_customer": number | null,"restrict_to_document_ids": (string)[] | null,"updated_at": string,"uses_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"discount_type": string,"discount_value": number,"expires_at": string,"id"?: string,"is_active"?: boolean,"max_uses": number,"max_uses_per_customer"?: number | null,"restrict_to_document_ids"?: (string)[] | null,"updated_at"?: string,"uses_count"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"discount_type"?: string,"discount_value"?: number,"expires_at"?: string,"id"?: string,"is_active"?: boolean,"max_uses"?: number,"max_uses_per_customer"?: number | null,"restrict_to_document_ids"?: (string)[] | null,"updated_at"?: string,"uses_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "category_id": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"duration_minutes": number | null,"id": string,"is_coming_soon": boolean,"lesson_count": number | null,"level": string | null,"locale": string,"price_cents": number | null,"pricing_type": string,"promo_youtube_id": string | null,"search_vector": unknown,"slug": string,"status": string,"thumbnail_key": string | null,"title": string,"translation_group_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_coming_soon"?: boolean,"lesson_count"?: number | null,"level"?: string | null,"locale"?: string,"price_cents"?: number | null,"pricing_type"?: string,"promo_youtube_id"?: string | null,"search_vector"?: unknown,"slug": string,"status"?: string,"thumbnail_key"?: string | null,"title": string,"translation_group_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_coming_soon"?: boolean,"lesson_count"?: number | null,"level"?: string | null,"locale"?: string,"price_cents"?: number | null,"pricing_type"?: string,"promo_youtube_id"?: string | null,"search_vector"?: unknown,"slug"?: string,"status"?: string,"thumbnail_key"?: string | null,"title"?: string,"translation_group_id"?: string | null,"updated_at"?: string
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
                },"document_files": {
                  Row: {
                    "checksum_sha256": string | null,"created_at": string,"document_id": string,"file_key": string,"format": string,"id": string,"is_current": boolean,"kind": string,"language": string,"size_bytes": number,"status": string,"updated_at": string,"uploaded_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum_sha256"?: string | null,"created_at"?: string,"document_id": string,"file_key": string,"format": string,"id"?: string,"is_current"?: boolean,"kind": string,"language": string,"size_bytes": number,"status"?: string,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "checksum_sha256"?: string | null,"created_at"?: string,"document_id"?: string,"file_key"?: string,"format"?: string,"id"?: string,"is_current"?: boolean,"kind"?: string,"language"?: string,"size_bytes"?: number,"status"?: string,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_files_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_files_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "report_top_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "category_id": string | null,"cover_image_key": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"doc_kind": string,"download_count": number,"file_format": string,"id": string,"page_count": number | null,"preview_pages": number,"price_cents": number,"published_at": string | null,"purchase_count": number,"search_vector": unknown,"seo_description": string | null,"seo_title": string | null,"slug": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"cover_image_key"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"doc_kind": string,"download_count"?: number,"file_format"?: string,"id"?: string,"page_count"?: number | null,"preview_pages"?: number,"price_cents": number,"published_at"?: string | null,"purchase_count"?: number,"search_vector"?: unknown,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"cover_image_key"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"doc_kind"?: string,"download_count"?: number,"file_format"?: string,"id"?: string,"page_count"?: number | null,"preview_pages"?: number,"price_cents"?: number,"published_at"?: string | null,"purchase_count"?: number,"search_vector"?: unknown,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"download_logs": {
                  Row: {
                    "document_file_id": string,"document_id": string,"downloaded_at": string,"entitlement_id": string,"id": number,"ip_hash": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "document_file_id": string,"document_id": string,"downloaded_at"?: string,"entitlement_id": string,"id"?: never,"ip_hash"?: string | null,"user_id": string
                  }
                  Update: {
                    "document_file_id"?: string,"document_id"?: string,"downloaded_at"?: string,"entitlement_id"?: string,"id"?: never,"ip_hash"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "download_logs_document_file_id_fkey"
      columns: ["document_file_id"]
isOneToOne: false
      referencedRelation: "document_files"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_logs_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_logs_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "report_top_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_logs_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"download_requests": {
                  Row: {
                    "decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"entitlement_id": string,"id": string,"note": string | null,"requested_at": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"entitlement_id": string,"id"?: string,"note"?: string | null,"requested_at"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"entitlement_id"?: string,"id"?: string,"note"?: string | null,"requested_at"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "download_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_requests_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "download_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"email_logs": {
                  Row: {
                    "created_at": string,"error": string | null,"id": number,"provider_message_id": string | null,"related_id": string | null,"related_type": string | null,"status": string,"template": string,"to_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"id"?: never,"provider_message_id"?: string | null,"related_id"?: string | null,"related_type"?: string | null,"status": string,"template": string,"to_email": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"id"?: never,"provider_message_id"?: string | null,"related_id"?: string | null,"related_type"?: string | null,"status"?: string,"template"?: string,"to_email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"entitlements": {
                  Row: {
                    "course_id": string | null,"document_id": string | null,"download_limit": number,"downloads_used": number,"expires_at": string | null,"granted_at": string,"granted_by": string | null,"id": string,"item_type": string,"language": string | null,"order_item_id": string | null,"revoke_reason": string | null,"revoked_at": string | null,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"document_id"?: string | null,"download_limit": number,"downloads_used"?: number,"expires_at"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"item_type": string,"language"?: string | null,"order_item_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"source": string,"user_id": string
                  }
                  Update: {
                    "course_id"?: string | null,"document_id"?: string | null,"download_limit"?: number,"downloads_used"?: number,"expires_at"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"item_type"?: string,"language"?: string | null,"order_item_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "report_top_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "id": string,"invoice_number": string,"issued_at": string,"order_id": string,"pdf_key": string | null,"seller_snapshot": NonNullable<Json>,"tax_cents": number,"tax_label": string | null,"tax_rate_bps": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"invoice_number": string,"issued_at"?: string,"order_id": string,"pdf_key"?: string | null,"seller_snapshot": NonNullable<Json>,"tax_cents"?: number,"tax_label"?: string | null,"tax_rate_bps"?: number | null
                  }
                  Update: {
                    "id"?: string,"invoice_number"?: string,"issued_at"?: string,"order_id"?: string,"pdf_key"?: string | null,"seller_snapshot"?: NonNullable<Json>,"tax_cents"?: number,"tax_label"?: string | null,"tax_rate_bps"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
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
    },{
      foreignKeyName: "media_assets_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "course_id": string | null,"created_at": string,"document_id": string | null,"id": string,"item_type": string,"language": string | null,"line_total_cents": number,"order_id": string,"quantity": number,"title_snapshot": string,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"document_id"?: string | null,"id"?: string,"item_type": string,"language"?: string | null,"line_total_cents": number,"order_id": string,"quantity"?: number,"title_snapshot": string,"unit_price_cents": number
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"document_id"?: string | null,"id"?: string,"item_type"?: string,"language"?: string | null,"line_total_cents"?: number,"order_id"?: string,"quantity"?: number,"title_snapshot"?: string,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "report_top_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "bank_expiry_warned_at": string | null,"billing_address": Json | null,"billing_company": string | null,"billing_email": string | null,"billing_name": string | null,"billing_phone": string | null,"billing_tax_id": string | null,"cancel_reason": string | null,"coupon_code_snapshot": string | null,"coupon_id": string | null,"coupon_type_snapshot": string | null,"coupon_value_snapshot": number | null,"created_at": string,"currency": string,"discount_cents": number,"expires_at": string | null,"finalized_at": string | null,"id": string,"needs_review": boolean,"order_number": string,"paid_at": string | null,"payment_method": string | null,"payment_provider": string,"refund_policy_revision_id": string,"review_reason": string | null,"status": string,"subtotal_cents": number,"tax_cents": number,"terms_accepted_at": string,"terms_revision_id": string,"total_cents": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_expiry_warned_at"?: string | null,"billing_address"?: Json | null,"billing_company"?: string | null,"billing_email"?: string | null,"billing_name"?: string | null,"billing_phone"?: string | null,"billing_tax_id"?: string | null,"cancel_reason"?: string | null,"coupon_code_snapshot"?: string | null,"coupon_id"?: string | null,"coupon_type_snapshot"?: string | null,"coupon_value_snapshot"?: number | null,"created_at"?: string,"currency"?: string,"discount_cents"?: number,"expires_at"?: string | null,"finalized_at"?: string | null,"id"?: string,"needs_review"?: boolean,"order_number": string,"paid_at"?: string | null,"payment_method"?: string | null,"payment_provider"?: string,"refund_policy_revision_id": string,"review_reason"?: string | null,"status"?: string,"subtotal_cents": number,"tax_cents"?: number,"terms_accepted_at": string,"terms_revision_id": string,"total_cents": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "bank_expiry_warned_at"?: string | null,"billing_address"?: Json | null,"billing_company"?: string | null,"billing_email"?: string | null,"billing_name"?: string | null,"billing_phone"?: string | null,"billing_tax_id"?: string | null,"cancel_reason"?: string | null,"coupon_code_snapshot"?: string | null,"coupon_id"?: string | null,"coupon_type_snapshot"?: string | null,"coupon_value_snapshot"?: number | null,"created_at"?: string,"currency"?: string,"discount_cents"?: number,"expires_at"?: string | null,"finalized_at"?: string | null,"id"?: string,"needs_review"?: boolean,"order_number"?: string,"paid_at"?: string | null,"payment_method"?: string | null,"payment_provider"?: string,"refund_policy_revision_id"?: string,"review_reason"?: string | null,"status"?: string,"subtotal_cents"?: number,"tax_cents"?: number,"terms_accepted_at"?: string,"terms_revision_id"?: string,"total_cents"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_refund_policy_revision_id_fkey"
      columns: ["refund_policy_revision_id"]
isOneToOne: false
      referencedRelation: "page_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_terms_revision_id_fkey"
      columns: ["terms_revision_id"]
isOneToOne: false
      referencedRelation: "page_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
    },{
      foreignKeyName: "page_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
    },{
      foreignKeyName: "pages_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "amount_cents": number | null,"currency": string | null,"event_key": string,"id": string,"order_id": string,"outcome": string | null,"processed_at": string | null,"provider": string,"provider_payment_id": string | null,"raw_payload": Json | null,"received_at": string,"signature_valid": boolean | null,"status_code": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents"?: number | null,"currency"?: string | null,"event_key": string,"id"?: string,"order_id": string,"outcome"?: string | null,"processed_at"?: string | null,"provider"?: string,"provider_payment_id"?: string | null,"raw_payload"?: Json | null,"received_at"?: string,"signature_valid"?: boolean | null,"status_code"?: number | null
                  }
                  Update: {
                    "amount_cents"?: number | null,"currency"?: string | null,"event_key"?: string,"id"?: string,"order_id"?: string,"outcome"?: string | null,"processed_at"?: string | null,"provider"?: string,"provider_payment_id"?: string | null,"raw_payload"?: Json | null,"received_at"?: string,"signature_valid"?: boolean | null,"status_code"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
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
    },{
      foreignKeyName: "site_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
                },"trainers": {
                  Row: {
                    "bio": string | null,"created_at": string,"email": string | null,"experience": string | null,"id": string,"is_active": boolean,"name": string,"order_index": number | null,"phone": string | null,"photo_key": string | null,"position": string,"qualifications": string | null,"search_vector": unknown,"slug": string,"updated_at": string,"whatsapp_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"email"?: string | null,"experience"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"order_index"?: number | null,"phone"?: string | null,"photo_key"?: string | null,"position": string,"qualifications"?: string | null,"search_vector"?: unknown,"slug": string,"updated_at"?: string,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"email"?: string | null,"experience"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"order_index"?: number | null,"phone"?: string | null,"photo_key"?: string | null,"position"?: string,"qualifications"?: string | null,"search_vector"?: unknown,"slug"?: string,"updated_at"?: string,"whatsapp_number"?: string | null
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
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
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
      foreignKeyName: "video_comments_moderated_by_fkey"
      columns: ["moderated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
      foreignKeyName: "video_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
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
            "feed_items": {
                  Row: {
                    "category_id": string | null,"comment_count": number | null,"deleted_at": string | null,"id": string | null,"image": string | null,"kind": string | null,"like_count": number | null,"locale": string | null,"published_at": string | null,"status": string | null,"summary": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"home_counters": {
                  Row: {
                    "published_articles": number | null,"published_documents": number | null,"registered_users": number | null,"total_downloads": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"public_profiles": {
                  Row: {
                    "avatar_url": string | null,"display_name": string,"id": string,"is_staff": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"display_name"?: string | null,"id"?: string | null,"is_staff"?: never
                         }
                        Update: {
                           "avatar_url"?: string | null,"display_name"?: string | null,"id"?: string | null,"is_staff"?: never
                         }
                        Relationships: [
                    
                  ]
                },"report_daily_sales": {
                  Row: {
                    "bank_gross_cents": number | null,"card_gross_cents": number | null,"chargebacks": number | null,"paid_orders": number | null,"sale_date": string | null,"total_gross_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"report_top_documents": {
                  Row: {
                    "doc_kind": string,"download_count": number,"id": string,"revenue_cents": number | null,"revenue_en_cents": number | null,"revenue_si_cents": number | null,"revenue_ta_cents": number | null,"title": string,"units_sold": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "create_profile_for":
{ Args: { "p_user": unknown }; Returns: undefined
                           },
"has_permission":
{ Args: { "p_action": string }; Returns: boolean
                           },
"is_staff_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"profile_is_super_admin":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
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
