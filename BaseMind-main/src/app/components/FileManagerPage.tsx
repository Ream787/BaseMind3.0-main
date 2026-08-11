import { useState, useRef } from "react";
import { useData, type Folder, type GroupFile } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  FolderPlus,
  Upload,
  Search,
  Folder as FolderIcon,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  Trash2,
  Download,
  X,
  ChevronRight,
  Home,
  Loader2,
  AlertCircle,
} from "lucide-react";

const typeIcons: Record<string, typeof FileText> = {
  PDF: FileText,
  DOCX: FileText,
  XLSX: FileSpreadsheet,
  PNG: FileImage,
  JPG: FileImage,
  TXT: FileText,
};

export function FileManagerPage() {
  const { folders, setFolders, groupFiles, setGroupFiles, groups } = useData();
  const { currentUser, hasPermission, activeGroupId } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = hasPermission(["Admin", "Group Manager"]);

  if (!currentUser) return null;

  // Determine which group we're viewing
  const viewingGroupId = activeGroupId && activeGroupId !== "all" ? activeGroupId : null;

  // Filter folders and files for the active group
  const myFolders = folders.filter((f) => f.groupId === viewingGroupId);
  const myFiles = groupFiles.filter((f) => f.groupId === viewingGroupId);

  // Get current folder's subfolders and files
  const currentFolders = myFolders.filter((f) => f.parentId === currentFolderId);
  const currentFiles = myFiles.filter((f) => f.folderId === currentFolderId);

  // Filter by search
  const filteredFolders = currentFolders.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFiles = currentFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get breadcrumb path
  const getBreadcrumbs = () => {
    const crumbs: Folder[] = [];
    let folderId = currentFolderId;

    while (folderId) {
      const folder = myFolders.find((f) => f.id === folderId);
      if (!folder) break;
      crumbs.unshift(folder);
      folderId = folder.parentId;
    }

    return crumbs;
  };

  const createFolder = () => {
    if (!folderName.trim() || !viewingGroupId) return;

    const newFolder: Folder = {
      id: `folder${Date.now()}`,
      name: folderName.trim(),
      parentId: currentFolderId,
      groupId: viewingGroupId,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setFolders((prev) => [...prev, newFolder]);
    setFolderName("");
    setShowNewFolder(false);
  };

  const deleteFolder = (folderId: string) => {
    if (!confirm("Delete this folder and all its contents?")) return;

    // Recursively collect all folder IDs to delete
    const toDelete = new Set<string>([folderId]);
    const collectSubfolders = (parentId: string) => {
      const subfolders = myFolders.filter((f) => f.parentId === parentId);
      subfolders.forEach((f) => {
        toDelete.add(f.id);
        collectSubfolders(f.id);
      });
    };
    collectSubfolders(folderId);

    // Delete folders
    setFolders((prev) => prev.filter((f) => !toDelete.has(f.id)));
    // Delete files in those folders
    setGroupFiles((prev) =>
      prev.filter((f) => f.folderId === null || !toDelete.has(f.folderId))
    );
  };

  const deleteFile = (fileId: string) => {
    if (!confirm("Delete this file?")) {
      return;
    }
    setGroupFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadError("");
  };

  const uploadFile = async () => {
    if (!selectedFile || !viewingGroupId) {
      setUploadError("Please select a file and ensure you're viewing a group");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = () => {
        const fileExt = selectedFile.name.split(".").pop()?.toUpperCase() || "FILE";
        const newFile: GroupFile = {
          id: `file${Date.now()}`,
          name: selectedFile.name,
          type: ["PDF", "DOCX", "TXT", "XLSX", "PNG", "JPG"].includes(fileExt)
            ? fileExt
            : "FILE",
          size: selectedFile.size,
          folderId: currentFolderId,
          groupId: viewingGroupId,
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString().split("T")[0],
          fileData: reader.result as string,
        };

        setGroupFiles((prev) => [...prev, newFile]);
        setShowUpload(false);
        setSelectedFile(null);
        setUploading(false);
      };

      reader.onerror = () => {
        setUploadError("Failed to read file");
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setUploadError("Failed to upload file");
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) =>
    bytes > 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${(bytes / 1000).toFixed(0)} KB`;

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const downloadFile = (file: GroupFile) => {
    if (!file.fileData) {
      alert("File data not available");
      return;
    }

    const link = document.createElement("a");
    link.href = file.fileData;
    link.download = file.name;
    link.click();
  };

  const currentGroup = groups.find((g) => g.id === viewingGroupId);

  if (!viewingGroupId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground">File Manager</h1>
          <p className="text-sm text-muted-foreground">
            Organize and manage group files with folders
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
          <h3 className="text-foreground mb-2">Select a Group</h3>
          <p className="text-sm text-muted-foreground">
            Please select a specific group from the sidebar to view and manage files.
            Files are organized per group for privacy and organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">File Manager</h1>
          <p className="text-sm text-muted-foreground">
            {currentGroup?.name} · {myFolders.length} folders · {myFiles.length} files
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground"
            >
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
            <button
              onClick={() => {
                setShowUpload(true);
                setSelectedFile(null);
                setUploadError("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setCurrentFolderId(null)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="w-4 h-4" />
          <span>Root</span>
        </button>
        {getBreadcrumbs().map((folder) => (
          <div key={folder.id} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setCurrentFolderId(folder.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files and folders..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground"
        />
      </div>

      {/* Files and Folders Grid */}
      <div className="bg-card rounded-xl border border-border p-4">
        {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground mb-1">
              {search ? "No results found" : "This folder is empty"}
            </p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? search
                  ? "Try adjusting your search"
                  : "Create folders or upload files to get started"
                : "No files or folders to display"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Folders */}
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className="group bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors cursor-pointer relative"
                onDoubleClick={() => setCurrentFolderId(folder.id)}
              >
                <div className="flex items-start gap-3">
                  <FolderIcon className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-foreground truncate font-medium">{folder.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {myFolders.filter((f) => f.parentId === folder.id).length} folders,{" "}
                      {myFiles.filter((f) => f.folderId === folder.id).length} files
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(folder.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => {
              const Icon = typeIcons[file.type] || File;
              return (
                <div
                  key={file.id}
                  className="group bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground truncate text-sm font-medium">
                        {file.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.type} · {formatSize(file.size)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{file.uploadedAt}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <button
                      onClick={() => downloadFile(file)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-border rounded hover:bg-muted text-foreground"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    {canManage && (
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-1.5 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">New Folder</h2>
              <button onClick={() => setShowNewFolder(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Folder Name
                </label>
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createFolder()}
                  placeholder="e.g. Meeting Notes"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewFolder(false)}
                className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                disabled={!folderName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">Upload File</h2>
              <button onClick={() => setShowUpload(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select File
                </label>
                <div
                  onClick={openFileDialog}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <span className="text-sm text-foreground">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatSize(selectedFile.size)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-foreground">Click to select file</p>
                      <p className="text-xs text-muted-foreground mt-1">Any file type</p>
                    </>
                  )}
                </div>
              </div>

              {currentFolderId && (
                <div className="p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
                  Uploading to: <strong>{getBreadcrumbs().pop()?.name || "Root"}</strong>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUpload(false)}
                className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={uploadFile}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={uploading || !selectedFile}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
