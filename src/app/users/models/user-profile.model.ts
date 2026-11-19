export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  bio: string | null;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  deletedAt?: number | null;
}