export const SEEDANCE_AVATARS_BUCKET = "seedance-avatars"

export type AvatarStatus =
  | "pending_verification"
  | "verified"
  | "failed"

export type AvatarAssetStatus = "processing" | "active" | "failed"

export interface AvatarRow {
  id: string
  user_id: string
  name: string
  status: AvatarStatus
  ark_group_id: string | null
  byted_token: string | null
  h5_link: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface AvatarAssetRow {
  id: string
  avatar_id: string
  user_id: string
  name: string
  storage_path: string
  ark_asset_id: string | null
  status: AvatarAssetStatus
  error: string | null
  created_at: string
  updated_at: string
}
