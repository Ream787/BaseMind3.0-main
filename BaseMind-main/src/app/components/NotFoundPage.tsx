import { useNavigate } from "react-router";
import { Compass } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <Compass className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
        <h1 className="text-4xl text-foreground mb-2">404</h1>
        <p className="text-muted-foreground mb-6">Page not found</p>
        <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
