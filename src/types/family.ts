export interface MergedProfileInfo {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
  ownerName?: string;
  linkedUserId?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  birthYear?: number;
  deathYear?: number;
  gender: 'male' | 'female';
  photoUrl?: string;
  coverUrl?: string;
  spouseId?: string;
  parentIds?: string[];
  childrenIds?: string[];
  // Position for canvas layout
  position?: { x: number; y: number };
  // For Supabase integration
  supabaseId?: string;
  linkedUserId?: string;
  // Merged profiles (other users' duplicates merged into this one)
  mergedProfiles?: MergedProfileInfo[];
}

export interface AddMemberData {
  name: string;
  birthYear?: number;
  deathYear?: number;
  gender: 'male' | 'female';
  photoUrl?: string;
  coverUrl?: string;
}

export type AddMemberType = 'parents' | 'spouse' | 'child';
