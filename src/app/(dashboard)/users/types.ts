export type Role = 'customer' | 'staff' | 'manager';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  role: Role;
  phone_verified: boolean;
  created_at: string;
};
