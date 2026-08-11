import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { DataProvider, useData } from "./context/DataContext";
import { AuthProvider } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { isLoading } = useData();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground text-lg">Loading ScoutManager...</p>
          <p className="text-sm text-muted-foreground mt-2">Syncing data from server</p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </DataProvider>
    </ThemeProvider>
  );
}