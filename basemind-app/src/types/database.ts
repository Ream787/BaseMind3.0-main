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
  /** Chosen emblem key, or "initials"; null means "work it out from the id". */
  avatar_emblem: string | null;
  /** Chosen hue, 1-8; null means "work it out from the id". */
  avatar_colour: number | null;
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
  /** Colour of the physical band marking this item, where the group uses one. */
  label_colour: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * label_colour is optional: the database defaults it to null and most kit
 * carries no band. Where an item lives is a placement, not a column here.
 */
export type NewEquipment = Omit<
  Equipment,
  "id" | "created_at" | "updated_at" | "label_colour"
> &
  Partial<Pick<Equipment, "label_colour">>;
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
  hospital_name: string | null;
  hospital_phone: string | null;
  hospital_address: string | null;
  hospital_distance: string | null;
  emergency_notes: string | null;
  emergency_access: string | null;
  created_at: string;
  updated_at: string;
};

export type SafetyPlan = {
  id: string;
  event_id: string;
  leader_in_charge: string | null;
  leader_phone: string | null;
  standby_name: string | null;
  standby_phone: string | null;
  first_aider_name: string | null;
  first_aider_phone: string | null;
  emergency_number: string | null;
  ambulance_number: string | null;
  extra_notes: string | null;
  generated_text: string | null;
  generated_at: string | null;
  generated_by: "template" | "gemini" | null;
  created_at: string;
  updated_at: string;
};

export type NewSafetyPlan = Omit<SafetyPlan, "id" | "created_at" | "updated_at">;

export type SafetyScenario = {
  id: string;
  safety_plan_id: string;
  scenario: string;
  response: string;
  destination: string | null;
  contact_phone: string | null;
  sort_order: number;
  created_at: string;
};

export type NewSafetyScenario = Omit<SafetyScenario, "id" | "created_at">;

export type Policy = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  storage_path: string | null;
  /** Extracted text; empty means nothing readable was found. */
  content: string;
  page_count: number | null;
  /** Where it was downloaded from, so it can be re-fetched later. */
  source_url: string | null;
  source_fetched_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewPolicy = Omit<Policy, "id" | "created_at" | "updated_at">;

export type PolicyChat = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type NewPolicyChat = Omit<PolicyChat, "id" | "created_at" | "updated_at" | "title"> &
  Partial<Pick<PolicyChat, "title">>;

/** Renaming, and bumping a chat to the top of the list after a new answer. */
export type PolicyChatUpdate = Partial<Pick<PolicyChat, "title" | "updated_at">>;

export type PolicyChatMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  /**
   * The checked answer for an assistant message - citations already matched
   * against the documents they quote. Null on a user's own message.
   */
  result: unknown;
  created_at: string;
};

export type NewPolicyChatMessage = Omit<PolicyChatMessage, "id" | "created_at">;

export type EquipmentBox = {
  id: string;
  /** What the QR sticker encodes. Unique, case-insensitively. */
  code: string;
  name: string;
  location: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Only the code is required; the database names and files a new box itself. */
export type NewEquipmentBox = Omit<
  EquipmentBox,
  "id" | "created_at" | "updated_at" | "name" | "location" | "notes" | "created_by"
> &
  Partial<Pick<EquipmentBox, "name" | "location" | "notes" | "created_by">>;

export type EquipmentBoxUpdate = Partial<
  Pick<EquipmentBox, "name" | "location" | "notes">
>;

/**
 * How many of an item are in one place.
 *
 * Exactly one of box_id and location is set: kit is either in a box, or
 * loose in a room. A boxed placement takes its room from the box, so moving
 * a box moves everything in it without touching a single placement.
 */
export type EquipmentPlacement = {
  id: string;
  equipment_id: string;
  box_id: string | null;
  location: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type NewEquipmentPlacement = Omit<
  EquipmentPlacement,
  "id" | "created_at" | "updated_at"
>;

export type MazeRun = {
  id: string;
  user_id: string;
  seconds: number;
  moves: number;
  size: number;
  completed_at: string;
};

export type NewMazeRun = Omit<MazeRun, "id" | "completed_at">;

export type FeatureKey =
  | "equipment"
  | "loans"
  | "events"
  | "sites"
  | "menus"
  | "food"
  | "forms"
  | "safety"
  | "policies";

export type FeatureFlag = {
  key: FeatureKey;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
};

export type CampForm = {
  id: string;
  name: string;
  description: string | null;
  storage_path: string;
  /** Maps the PDF's own field names to BaseMind data keys. */
  field_map: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type NewCampForm = Omit<CampForm, "id" | "created_at" | "updated_at">;

export type NewCampingSite = Omit<CampingSite, "id" | "created_at" | "updated_at">;

export type CampEvent = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  site_id: string | null;
  notes: string | null;
  /** How many people are going; scales menu quantities. */
  headcount: number | null;
  created_at: string;
  updated_at: string;
};

export type Menu = {
  id: string;
  name: string;
  description: string | null;
  /** How many people the quantities are written for. */
  serves: number;
  day_count: number;
  category: string | null;
  /** Null for a reusable preset; set for a particular camp's menu. */
  event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewMenu = Omit<Menu, "id" | "created_at" | "updated_at">;

export type MenuMeal = {
  id: string;
  menu_id: string;
  day_number: number;
  meal_slot: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export type NewMenuMeal = Omit<MenuMeal, "id" | "created_at">;

export type MenuMealItem = {
  id: string;
  meal_id: string;
  food_item_id: string;
  quantity: number;
  created_at: string;
};

export type NewMenuMealItem = Omit<MenuMealItem, "id" | "created_at">;

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
      equipment_boxes: TableDef<EquipmentBox, NewEquipmentBox, EquipmentBoxUpdate>;
      equipment_placements: TableDef<EquipmentPlacement, NewEquipmentPlacement>;
      maze_runs: TableDef<MazeRun, NewMazeRun>;
      equipment_loans: TableDef<EquipmentLoan, NewEquipmentLoan>;
      camping_sites: TableDef<CampingSite, NewCampingSite>;
      events: TableDef<CampEvent, NewCampEvent>;
      event_equipment: TableDef<EventEquipment, NewEventEquipment>;
      food_items: TableDef<FoodItem, NewFoodItem>;
      event_food: TableDef<EventFood, NewEventFood>;
      menus: TableDef<Menu, NewMenu>;
      menu_meals: TableDef<MenuMeal, NewMenuMeal>;
      menu_meal_items: TableDef<MenuMealItem, NewMenuMealItem>;
      safety_plans: TableDef<SafetyPlan, NewSafetyPlan>;
      safety_scenarios: TableDef<SafetyScenario, NewSafetyScenario>;
      camp_forms: TableDef<CampForm, NewCampForm>;
      feature_flags: TableDef<FeatureFlag, FeatureFlag, Partial<FeatureFlag>>;
      policies: TableDef<Policy, NewPolicy>;
      policy_chats: TableDef<PolicyChat, NewPolicyChat, PolicyChatUpdate>;
      policy_chat_messages: TableDef<PolicyChatMessage, NewPolicyChatMessage>;
    };
    Views: { [_ in never]: never };
    Functions: {
      apply_menu_preset: {
        Args: { preset_id: string; target_event_id: string; target_headcount?: number | null };
        Returns: string;
      };
      place_equipment: {
        Args: {
          p_equipment_id: string;
          p_box_id: string | null;
          p_location: string | null;
          p_quantity: number;
        };
        Returns: void;
      };
      delete_equipment_box: {
        Args: { p_box_id: string; p_keep_contents?: boolean };
        Returns: void;
      };
      merge_equipment: {
        Args: { keep_id: string; drop_id: string };
        Returns: void;
      };
      save_menu_as_preset: {
        Args: { source_menu_id: string; preset_name: string; preset_category?: string | null };
        Returns: string;
      };
    };
  };
};
