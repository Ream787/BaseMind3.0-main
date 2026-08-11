export type Role = "Admin" | "Manager" | "Member" | "Viewer";
export type UserStatus = "Pending" | "Active" | "Rejected";
export type EquipmentCondition = "Good" | "Needs Repair" | "Broken" | "Missing";

// These must be `type` aliases, not `interface`. Supabase's client generic
// constrains every table row to Record<string, unknown>, and interfaces don't
// get an implicit index signature — an interface here silently fails that
// constraint, which degrades every insert/update argument to `never`.
export type UserProfile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type Equipment = {
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
};

export type NewEquipment = Omit<Equipment, "id" | "created_at" | "updated_at">;
export type EquipmentUpdate = Partial<NewEquipment>;

export type EquipmentLoan = {
  id: string;
  equipment_id: string;
  quantity: number;
  borrower_name: string;
  scout_group: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  borrowed_on: string;
  due_back: string | null;
  /** Null while the item is still out. */
  returned_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewEquipmentLoan = Omit<EquipmentLoan, "id" | "created_at" | "updated_at">;

export type CampingSite = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewCampingSite = Omit<CampingSite, "id" | "created_at" | "updated_at">;

export type CampEvent = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  site_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewCampEvent = Omit<CampEvent, "id" | "created_at" | "updated_at">;

export type EventEquipment = {
  id: string;
  event_id: string;
  equipment_id: string;
  quantity: number;
  created_at: string;
};

export type NewEventEquipment = Omit<EventEquipment, "id" | "created_at">;

export type FoodItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewFoodItem = Omit<FoodItem, "id" | "created_at" | "updated_at">;

export type EventFood = {
  id: string;
  event_id: string;
  food_item_id: string;
  quantity: number;
  created_at: string;
};

export type NewEventFood = Omit<EventFood, "id" | "created_at">;

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<
        UserProfile,
        Partial<UserProfile> & Pick<UserProfile, "id" | "email">,
        Partial<UserProfile>
      >;
      equipment: TableDef<Equipment, NewEquipment, EquipmentUpdate>;
      equipment_loans: TableDef<EquipmentLoan, NewEquipmentLoan>;
      camping_sites: TableDef<CampingSite, NewCampingSite>;
      events: TableDef<CampEvent, NewCampEvent>;
      event_equipment: TableDef<EventEquipment, NewEventEquipment>;
      food_items: TableDef<FoodItem, NewFoodItem>;
      event_food: TableDef<EventFood, NewEventFood>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};
