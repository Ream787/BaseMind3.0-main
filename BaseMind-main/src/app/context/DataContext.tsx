import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabaseUrl, publicAnonKey, projectId } from "../../../utils/supabase/info";
import { supabase } from "../../../utils/supabase/client";

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export type UserRole = "Admin" | "Group Manager" | "Member" | "Viewer";
export type UserStatus = "Active" | "Pending" | "Rejected";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  groupIds: string[];
  role: UserRole;
  status: UserStatus;
  password?: string;
  createdAt: string;
  passwordResetAt?: string;
  mustChangePassword?: boolean;
  profilePicture?: string;
}

export type EquipmentCondition = "Good" | "Needs Repair" | "Broken" | "Missing";

export interface Equipment {
  id: string;
  name: string;
  quantity: number;
  location: string;
  dateLastChecked: string;
  checkedBy: string;
  nextCheckDate: string;
  condition: EquipmentCondition;
  notes: string;
  groupId: string;
  category?: string;
}

export interface CampingLocation {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  capacity: number;
  facilities: string;
  notes: string;
  groupId: string;
}

export interface CampPlan {
  id: string;
  name: string;
  locationId: string;
  startDate: string;
  endDate: string;
  equipmentIds: string[];
  groupId: string;
  createdBy: string;
  createdAt: string;
  notes: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  groupId: string;
  uploadedBy: string;
  uploadedAt: string;
  content: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  groupId: string;
  createdBy: string;
  createdAt: string;
}

export interface GroupFile {
  id: string;
  name: string;
  type: string;
  size: number;
  folderId: string | null;
  groupId: string;
  uploadedBy: string;
  uploadedAt: string;
  fileData?: string;
}

export interface AppSettings {
  registrationEnabled: boolean;
  accessCode: string;
  features: {
    equipmentTrackingEnabled: boolean;
    campPlanningEnabled: boolean;
    documentManagementEnabled: boolean;
    groupManagementEnabled: boolean;
  };
}

const defaultGroups: Group[] = [
  { id: "grp1", name: "Joey Scouts", createdAt: "2025-01-20" },
  { id: "grp2", name: "Cub Scouts", createdAt: "2025-02-01" },
  { id: "grp3", name: "Venturers", createdAt: "2025-04-01" },
];

const defaultUsers: User[] = [
  { id: "u1", name: "Sarah Mitchell", email: "admin@scouts.org", phone: "0400111222", groupIds: ["grp1", "grp2", "grp3"], role: "Admin", status: "Active", password: "admin123", createdAt: "2025-01-15" },
  { id: "u2", name: "James Chen", email: "james@scouts.org", phone: "0400333444", groupIds: ["grp1", "grp2"], role: "Group Manager", status: "Active", password: "manager123", createdAt: "2025-01-20" },
  { id: "u3", name: "Emily Walker", email: "emily@scouts.org", phone: "0400555666", groupIds: ["grp1"], role: "Member", status: "Active", password: "member123", createdAt: "2025-02-10" },
  { id: "u4", name: "Tom Harris", email: "tom@scouts.org", phone: "0400777888", groupIds: ["grp2"], role: "Viewer", status: "Active", password: "viewer123", createdAt: "2025-03-01" },
  { id: "u5", name: "Lisa Wong", email: "lisa@scouts.org", phone: "0400999000", groupIds: ["grp1"], role: "Member", status: "Pending", createdAt: "2026-04-01" },
];

const defaultEquipment: Equipment[] = [
  { id: "eq1", name: "4-Person Tent", quantity: 8, location: "Storage Shed A", dateLastChecked: "2026-03-15", checkedBy: "James Chen", nextCheckDate: "2026-06-15", condition: "Good", notes: "All seams intact", groupId: "grp1", category: "Shelter" },
  { id: "eq2", name: "Sleeping Bags", quantity: 24, location: "Storage Shed A", dateLastChecked: "2026-03-15", checkedBy: "James Chen", nextCheckDate: "2026-06-15", condition: "Good", notes: "", groupId: "grp1", category: "Sleeping" },
  { id: "eq3", name: "Camp Stove", quantity: 4, location: "Kitchen Store", dateLastChecked: "2026-02-20", checkedBy: "Emily Walker", nextCheckDate: "2026-05-20", condition: "Needs Repair", notes: "Gas valve on unit #3 leaks", groupId: "grp1", category: "Cooking" },
  { id: "eq4", name: "First Aid Kit", quantity: 6, location: "Office", dateLastChecked: "2026-04-01", checkedBy: "Sarah Mitchell", nextCheckDate: "2026-07-01", condition: "Good", notes: "Restocked bandages", groupId: "grp2", category: "Safety" },
  { id: "eq5", name: "Compass Set", quantity: 12, location: "Navigation Box", dateLastChecked: "2026-01-10", checkedBy: "James Chen", nextCheckDate: "2026-04-10", condition: "Good", notes: "", groupId: "grp1", category: "Navigation" },
  { id: "eq6", name: "Rope (50m)", quantity: 3, location: "Storage Shed B", dateLastChecked: "2025-12-01", checkedBy: "Tom Harris", nextCheckDate: "2026-03-01", condition: "Broken", notes: "1 rope frayed badly", groupId: "grp2", category: "Rigging" },
  { id: "eq7", name: "Backpacks", quantity: 15, location: "Storage Shed A", dateLastChecked: "2026-03-01", checkedBy: "Emily Walker", nextCheckDate: "2026-06-01", condition: "Missing", notes: "3 backpacks not returned from last camp", groupId: "grp1", category: "Carry" },
];

const defaultLocations: CampingLocation[] = [
  { id: "loc1", name: "Gilwell Park", address: "97 The Boulevard, Gembrook VIC 3783", phone: "03 5968 1399", email: "gilwell@scoutsvictoria.com.au", capacity: 200, facilities: "Cabins, Tent sites, Kitchen, Toilets, Showers, Activity areas", notes: "Premier camping facility", groupId: "grp1" },
  { id: "loc2", name: "Doxa Youth Camp", address: "250 Doxa Camp Rd, Malmsbury VIC 3446", phone: "03 5423 2410", email: "info@doxa.org.au", capacity: 120, facilities: "Dormitories, Dining hall, Swimming pool, Sports fields", notes: "Group booking required", groupId: "grp2" },
];

const defaultCampPlans: CampPlan[] = [
  { id: "cp1", name: "Winter Camp 2026", locationId: "loc1", startDate: "2026-06-20", endDate: "2026-06-22", equipmentIds: ["eq1", "eq2", "eq3", "eq4", "eq5"], groupId: "grp1", createdBy: "u2", createdAt: "2026-04-01", notes: "Annual winter camp" },
];

const defaultDocuments: Document[] = [
  { id: "doc1", name: "Safety Policy 2026.pdf", type: "PDF", size: 245000, groupId: "", uploadedBy: "Sarah Mitchell", uploadedAt: "2026-01-15", content: "Scout Safety Policy: All scouts must wear appropriate footwear. Campfires must be supervised at all times. First aid kits must be accessible. Emergency contacts must be recorded." },
  { id: "doc2", name: "Equipment Checklist.xlsx", type: "XLSX", size: 89000, groupId: "grp1", uploadedBy: "James Chen", uploadedAt: "2026-03-10", content: "Equipment checklist for camp preparation including tents, cooking gear, navigation tools, and safety equipment." },
  { id: "doc3", name: "Camp Cooking Guide.pdf", type: "PDF", size: 512000, groupId: "", uploadedBy: "Sarah Mitchell", uploadedAt: "2026-02-20", content: "Camp cooking guidelines: Always cook in designated areas. Store food in sealed containers. Clean up after meals. Proper fire safety when using camp stoves." },
];

interface DataContextType {
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  equipment: Equipment[];
  setEquipment: React.Dispatch<React.SetStateAction<Equipment[]>>;
  locations: CampingLocation[];
  setLocations: React.Dispatch<React.SetStateAction<CampingLocation[]>>;
  campPlans: CampPlan[];
  setCampPlans: React.Dispatch<React.SetStateAction<CampPlan[]>>;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  groupFiles: GroupFile[];
  setGroupFiles: React.Dispatch<React.SetStateAction<GroupFile[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  isLoading: boolean;
}

// Typed stub functions for default context values
const createTypedSetter = <T,>() => ((_value: T | ((val: T) => T)) => {}) as React.Dispatch<React.SetStateAction<T>>;

const DataContext = createContext<DataContextType>({
  groups: [],
  setGroups: createTypedSetter<Group[]>(),
  users: [],
  setUsers: createTypedSetter<User[]>(),
  equipment: [],
  setEquipment: createTypedSetter<Equipment[]>(),
  locations: [],
  setLocations: createTypedSetter<CampingLocation[]>(),
  campPlans: [],
  setCampPlans: createTypedSetter<CampPlan[]>(),
  documents: [],
  setDocuments: createTypedSetter<Document[]>(),
  folders: [],
  setFolders: createTypedSetter<Folder[]>(),
  groupFiles: [],
  setGroupFiles: createTypedSetter<GroupFile[]>(),
  settings: { 
    registrationEnabled: true, 
    accessCode: "",
    features: {
      equipmentTrackingEnabled: true,
      campPlanningEnabled: true,
      documentManagementEnabled: true,
      groupManagementEnabled: true,
    }
  },
  setSettings: createTypedSetter<AppSettings>(),
  isLoading: true,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<CampingLocation[]>([]);
  const [campPlans, setCampPlans] = useState<CampPlan[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [groupFiles, setGroupFiles] = useState<GroupFile[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ 
    registrationEnabled: true, 
    accessCode: "",
        features: {
          equipmentTrackingEnabled: true,
          campPlanningEnabled: true,
          documentManagementEnabled: true,
          groupManagementEnabled: true,
        }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load all data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Check if backend is available first
        let isBackendUp = false;
        try {
          console.log("🔍 Checking Supabase connection for project:", projectId);
          const { data, error } = await supabase.from('groups').select('id').limit(1);
          isBackendUp = !error;
          console.log("✅ Supabase connection status:", isBackendUp ? "Connected" : "Failed");
        } catch (err) {
          console.error("❌ Health check failed:", err);
          isBackendUp = false;
        }

        if (!isBackendUp) {
          console.info("📦 Backend not available - using default demo data. To enable persistence, follow the Supabase setup guide.");
          setGroups(defaultGroups);
          setUsers(defaultUsers);
          setEquipment(defaultEquipment);
          setLocations(defaultLocations);
          setCampPlans(defaultCampPlans);
          setDocuments(defaultDocuments);
          setFolders([]);
          setGroupFiles([]);
          setSettings({ 
            registrationEnabled: true, 
            accessCode: "",
            features: {
              equipmentTrackingEnabled: true,
              campPlanningEnabled: true,
              documentManagementEnabled: true,
              groupManagementEnabled: true,
            }
          });
          setInitialized(true);
          setBackendAvailable(false);
          setIsLoading(false);
          return;
        }

        // Backend is available, proceed with loading
        setBackendAvailable(true);

        // Load all collections in parallel
        const [groupsData, usersData, equipmentData, locationsData, campPlansData, documentsData, foldersData, groupFilesData, settingsData] = await Promise.all([
          supabase.from('groups').select('*'),
          supabase.from('users').select('*'),
          supabase.from('equipment').select('*'),
          supabase.from('camping_locations').select('*'),
          supabase.from('camp_plans').select('*'),
          supabase.from('documents').select('*'),
          supabase.from('folders').select('*'),
          supabase.from('files').select('*'),
          supabase.from('app_settings').select('*'),
        ]);

        // Log errors for debugging if any table fails to load
        const apiResponses = { groupsData, usersData, equipmentData, locationsData, campPlansData, documentsData };
        Object.entries(apiResponses).forEach(([name, res]) => {
          if (res.error) console.error(`❌ Table Load Error (${name}):`, res.error.message);
        });
        
        // Map Database Data to State (Handle snake_case conversion)
        let loadedSuccessfully = true;
        if (groupsData.error || !groupsData.data) {
          setGroups(defaultGroups);
          loadedSuccessfully = false;
        } else {
          setGroups(groupsData.data.map((g: any) => ({
            id: g.id,
            name: g.name,
            createdAt: g.created_at
          })));
        }

        if (equipmentData.data && !equipmentData.error) {
          setEquipment(equipmentData.data.map((e: any) => ({
            id: e.id,
            name: e.name,
            quantity: e.quantity,
            location: e.location,
            dateLastChecked: e.date_last_checked,
            checkedBy: e.checked_by,
            nextCheckDate: e.next_check_date,
            condition: e.condition,
            notes: e.notes,
            groupId: e.group_id
          })));
        } else {
          setEquipment(defaultEquipment);
        }

        if (usersData.error || !usersData.data) {
          setUsers(defaultUsers);
          loadedSuccessfully = false;
        } else {
          setUsers(usersData.data.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            status: u.status,
            groupIds: u.groupIds || [], // Preserve if provided or default to empty
            createdAt: u.created_at,
            profilePicture: u.profile_picture
          })));
        }

        setLocations(locationsData.data || defaultLocations);
        setCampPlans(campPlansData.data || defaultCampPlans);
        setDocuments(documentsData.data || defaultDocuments);
        setFolders(foldersData.data || []);
        setGroupFiles(groupFilesData.data || []);

        if (settingsData.data && settingsData.data.length > 0) {
          const dbSettings: any = {};
          settingsData.data.forEach((s: any) => dbSettings[s.key] = s.value);
          setSettings(prev => ({
            ...prev,
            registrationEnabled: dbSettings.registrationEnabled === 'true',
            accessCode: dbSettings.accessCode || ""
          }));
        } else {
          const defaultSettings = { 
            registrationEnabled: true, 
            accessCode: "",
            features: {
              equipmentTrackingEnabled: true,
              campPlanningEnabled: true,
              documentManagementEnabled: true,
              groupManagementEnabled: true,
            }
          };
          setSettings(defaultSettings);
        }

        setInitialized(true);
      } catch (error: any) {
        console.error("❌ Data Context Load Error:", error);
        console.info("📦 Falling back to default demo data.");
        // Fallback to defaults on error
        setGroups(defaultGroups);
        setUsers(defaultUsers);
        setEquipment(defaultEquipment);
        setLocations(defaultLocations);
        setCampPlans(defaultCampPlans);
        setDocuments(defaultDocuments);
        setInitialized(true);
        setBackendAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Save to backend whenever data changes
  useEffect(() => {
    if (!initialized || !backendAvailable || groups.length === 0 || groups === defaultGroups) return;
    const saveData = async () => {
      try {
        await supabase.from('groups').upsert(groups.map(g => ({
          id: g.id,
          name: g.name,
          created_at: g.createdAt || new Date().toISOString()
        })));
      } catch (error) {
        console.error("Error syncing groups:", error);
      }
    };
    saveData();
  }, [groups, initialized, backendAvailable]);

  useEffect(() => {
    if (!initialized || !backendAvailable || users.length === 0) return;
    const saveData = async () => {
      try {
        await supabase.from('users').upsert(users.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          created_at: u.createdAt || new Date().toISOString()
        })));
      } catch (error) {
        console.error("Error syncing users:", error);
      }
    };
    saveData();
  }, [users, initialized, backendAvailable]);

  useEffect(() => {
    if (!initialized || !backendAvailable) return;
    const saveData = async () => {
      try {
        await supabase.from('equipment').upsert(equipment.map(e => ({
          id: e.id,
          name: e.name,
          quantity: e.quantity,
          location: e.location,
          condition: e.condition,
          notes: e.notes,
          group_id: e.groupId,
          date_last_checked: e.dateLastChecked,
          next_check_date: e.nextCheckDate,
          checked_by: e.checkedBy
        })));
      } catch (error) {
        console.error("Error syncing equipment:", error);
      }
    };
    saveData();
  }, [equipment, initialized, backendAvailable]);

  useEffect(() => {
    if (!initialized || !backendAvailable) return;
    const saveData = async () => {
      try {
        await supabase.from('camping_locations').upsert(locations);
      } catch (error) {
        console.error("Error syncing locations:", error);
      }
    };
    saveData();
  }, [locations, initialized, backendAvailable]);

  useEffect(() => {
    if (!initialized || !backendAvailable) return;
    const saveData = async () => {
      try {
        await supabase.from('camp_plans').upsert(campPlans.map(cp => ({
          id: cp.id,
          name: cp.name,
          location_id: cp.locationId,
          start_date: cp.startDate,
          end_date: cp.endDate,
          group_id: cp.groupId,
          created_by: cp.createdBy,
          notes: cp.notes
        })));
      } catch (error) {
        console.error("Error syncing camp plans:", error);
      }
    };
    saveData();
  }, [campPlans, initialized, backendAvailable]);

  useEffect(() => {
    if (!initialized || !backendAvailable) return;
    const saveData = async () => {
      try {
        await supabase.from('documents').upsert(documents.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          size: d.size,
          group_id: d.groupId,
          uploaded_by: d.uploadedBy,
          content: d.content
        })));
      } catch (error) {
        console.error("Error syncing documents:", error);
      }
    };
    saveData();
  }, [documents, initialized, backendAvailable]);

  return (
    <DataContext.Provider
      value={{
        groups,
        setGroups,
        users,
        setUsers,
        equipment,
        setEquipment,
        locations,
        setLocations,
        campPlans,
        setCampPlans,
        documents,
        setDocuments,
        folders,
        setFolders,
        groupFiles,
        setGroupFiles,
        settings,
        setSettings,
        isLoading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);