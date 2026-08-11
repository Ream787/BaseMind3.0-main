import { useMemo, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/equipment": "Equipment",
  "/locations": "Camping Locations",
  "/camp-planning": "Camp Planning",
  "/reports": "Reports",
  "/files": "File Manager",
  "/users": "User Management",
  "/group-members": "Group Members",
  "/groups": "Groups",
  "/settings": "Settings",
};

const getRoleDescription = (role: string) => {
  if (role === "Admin") return "As an Admin, you can manage users, groups, equipment, locations, and settings.";
  if (role === "Group Manager") return "As a Group Manager, you can manage your assigned group, equipment, camp plans, and group members.";
  if (role === "Member") return "As a Member, you can view group data, equipment, and plans, and make edits where allowed.";
  return "As a Viewer, you can browse the app and review data but cannot make changes.";
};

const generateReply = (question: string, pageTitle: string, role: string) => {
  const normalized = question.toLowerCase();
  const roleHint = getRoleDescription(role);
  if (normalized.includes("equipment")) {
    return `You are on the ${pageTitle} page. ${roleHint} Use the filters and view toggles to switch between table, category, or location cards. If you need to add new inventory, click Add Equipment and choose or add a location.`;
  }
  if (normalized.includes("location")) {
    return `On the ${pageTitle} page, locations are selected from a dropdown. If the location is not listed, choose Add new location and type the new name. The app capitalizes the first letter automatically.`;
  }
  if (normalized.includes("group") || normalized.includes("member")) {
    return `Your current page is ${pageTitle}. ${roleHint} If you're a Group Manager or Admin, you can manage group members and assign them to groups. Viewers can only see data.`;
  }
  if (normalized.includes("settings")) {
    return `The Settings page lets you adjust app behavior and group preferences. ${roleHint} If you don't see a setting, your role may not have permission to change it.`;
  }
  return `You're on the ${pageTitle} page. ${roleHint} Ask me anything about how to use this screen, how to find equipment, or what actions are available based on your role.`;
};

export function HelpChatBubble() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([
    { role: "assistant", text: "Hi! I can help you use the app. Ask me about this page or your permissions." },
  ]);

  const pageTitle = useMemo(() => pageTitles[location.pathname] || "this page", [location.pathname]);
  const userRole = currentUser?.role || "Viewer";

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMessage = { role: "user", text: trimmed };
    const assistantMessage = { role: "assistant", text: generateReply(trimmed, pageTitle, userRole) };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <div className="fixed right-6 bottom-6 z-50">
      {open && (
        <div className="mb-3 w-[320px] rounded-3xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">App Assistant</p>
              <p className="text-xs text-muted-foreground">Page: {pageTitle} · Role: {userRole}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, index) => (
              <div key={index} className={msg.role === "assistant" ? "rounded-2xl bg-muted p-3 text-sm text-foreground" : "rounded-2xl bg-primary/10 p-3 text-sm text-foreground"}>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about this page..."
                className="flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <button onClick={sendMessage} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
        aria-label="Open help chatbot"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
}
