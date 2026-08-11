export type Role = "Admin" | "Manager" | "Member" | "Viewer";
export type UserStatus = "Pending" | "Active" | "Rejected";
export type EquipmentCondition = "Good" | "Needs Repair" | "Broken" | "Missing";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  location: string;
  condition: EquipmentCondition;
  notes: string | null;
  date_last_checked: string | null;
  next_check_date: string | null;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
}

export type NewEquipment = Omit<Equipment, "id" | "created_at" | "updated_at">;
export type EquipmentUpdate = Partial<NewEquipment>;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & Pick<UserProfile, "id" | "email">;
        Update: Partial<UserProfile>;
      };
      equipment: {
        Row: Equipment;
        Insert: NewEquipment;
        Update: EquipmentUpdate;
      };
    };
  };
}
