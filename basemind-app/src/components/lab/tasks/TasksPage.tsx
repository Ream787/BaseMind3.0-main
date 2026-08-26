import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { format, isPast, parseISO } from "date-fns";
import { CircleAlert, ListTodo, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { TASK_STATUSES, type Task } from "@/types/lab";
import type { UserProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/users/UserAvatar";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState } from "@/components/lab/LabUi";
import { CAMP_TABS } from "@/components/layout/SectionTabs";

/**
 * What still needs doing before a camp.
 *
 * A board rather than a list, because the useful question is not "what is
 * left" but "what is stuck" — and Blocked being its own column is the only
 * way that shows up before the Thursday before.
 *
 * Drag and drop is the browser's own, not a library: the whole interaction
 * is "pick up a card, drop it in a column", and 40 kilobytes of dependency
 * to avoid writing four event handlers is a bad trade on a phone at a
 * campsite. Every card also has a plain select, so the board works by
 * touch and by keyboard where dragging does not.
 */

const COLUMN_STYLES: Record<string, string> = {
  Todo: "border-t-muted-foreground/40",
  Doing: "border-t-primary",
  Blocked: "border-t-destructive",
  Done: "border-t-emerald-500",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Must happen",
  2: "Normal",
  3: "If there's time",
};

export function TasksPage() {
  const { hasRole, profile } = useAuth();
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: tasks, loading } = useLabTable("tasks", { orderBy: "sort_order" });

  const [eventFilter, setEventFilter] = useState("all");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .eq("status", "Active")
      .order("name")
      .then(({ data }) => setUsers((data ?? []) as UserProfile[]));
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const visible = useMemo(() => {
    if (eventFilter === "all") return tasks;
    if (eventFilter === "none") return tasks.filter((t) => !t.event_id);
    return tasks.filter((t) => t.event_id === eventFilter);
  }, [tasks, eventFilter]);

  const columns = useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        status,
        tasks: visible
          .filter((t) => t.status === status)
          .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order),
      })),
    [visible],
  );

  const overdue = visible.filter(
    (t) => t.status !== "Done" && t.due_on && isPast(parseISO(t.due_on)),
  ).length;

  async function move(taskId: string, status: string) {
    const { error } = await labDb.from("tasks").update({ status }).eq("id", taskId);
    if (error) toast.error(error.message);
  }

  function onDrop(e: DragEvent<HTMLDivElement>, status: string) {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    if (id) void move(id, status);
  }

  return (
    <LabPage
      title="Camp to-do"
      description="Everything that has to happen before the minibus leaves."
      feature="tasks"
      tabs={CAMP_TABS}
      actions={
        canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add task
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="none">Not tied to a camp</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" />
            {overdue} overdue
          </span>
        )}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="size-6" />}
          title="Nothing on the list"
          description="Add the things that have to happen before a camp — booking the minibus, chasing forms, checking the tents."
          action={
            canEdit ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add the first task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map(({ status, tasks: list }) => (
            <div
              key={status}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverColumn(status);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => onDrop(e, status)}
              className={`rounded-lg border border-t-4 bg-card p-2 transition-colors ${
                COLUMN_STYLES[status]
              } ${dragOverColumn === status ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-sm font-medium">{status}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </div>

              <ul className="space-y-2">
                {list.map((task) => {
                  const assignee = task.assignee_id ? usersById.get(task.assignee_id) : null;
                  const event = task.event_id ? eventsById.get(task.event_id) : null;
                  const late =
                    task.status !== "Done" && task.due_on && isPast(parseISO(task.due_on));

                  return (
                    <li
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(task.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={`rounded-md border bg-background p-2.5 text-sm transition-opacity ${
                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragging === task.id ? "opacity-40" : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          if (!canEdit) return;
                          setEditing(task);
                          setDialogOpen(true);
                        }}
                      >
                        <p
                          className={
                            task.status === "Done"
                              ? "font-medium text-muted-foreground line-through"
                              : "font-medium"
                          }
                        >
                          {task.title}
                        </p>
                        {task.detail && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {task.detail}
                          </p>
                        )}
                      </button>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {task.priority === 1 && (
                          <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">
                            Must
                          </span>
                        )}
                        {task.due_on && (
                          <span className={late ? "font-medium text-destructive" : undefined}>
                            {format(parseISO(task.due_on), "d MMM")}
                          </span>
                        )}
                        {event && <span className="truncate">{event.name}</span>}
                        {assignee && (
                          <span className="ml-auto flex items-center gap-1">
                            <UserAvatar user={assignee} size="sm" className="size-5" />
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <div className="mt-2 flex items-center gap-1">
                          {/* The board's keyboard and touch path. Dragging is
                              the nice way; this is the way that always works. */}
                          <Select value={task.status} onValueChange={(v) => move(task.id, v)}>
                            <SelectTrigger className="h-7 flex-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              aria-label={`Delete ${task.title}`}
                              onClick={async () => {
                                const { error } = await labDb
                                  .from("tasks")
                                  .delete()
                                  .eq("id", task.id);
                                if (error) toast.error(error.message);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}

                {list.length === 0 && (
                  <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Nothing here
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        events={events}
        users={users}
        defaultEventId={eventFilter !== "all" && eventFilter !== "none" ? eventFilter : ""}
        authorId={profile?.id ?? null}
        nextSort={tasks.length + 1}
      />
    </LabPage>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  task,
  events,
  users,
  defaultEventId,
  authorId,
  nextSort,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  events: { id: string; name: string }[];
  users: UserProfile[];
  defaultEventId: string;
  authorId: string | null;
  nextSort: number;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<string>("Todo");
  const [eventId, setEventId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState("2");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDetail(task?.detail ?? "");
    setStatus(task?.status ?? "Todo");
    setEventId(task?.event_id ?? defaultEventId);
    setAssignee(task?.assignee_id ?? "");
    setDueOn(task?.due_on ?? "");
    setPriority(String(task?.priority ?? 2));
  }, [open, task, defaultEventId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      detail: detail.trim() || null,
      status,
      event_id: eventId || null,
      assignee_id: assignee || null,
      due_on: dueOn || null,
      priority: Number(priority),
    };

    const { error } = task
      ? await labDb.from("tasks").update(payload).eq("id", task.id)
      : await labDb
          .from("tasks")
          .insert({ ...payload, sort_order: nextSort, created_by: authorId });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(task ? "Task updated" : "Task added");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              Tie it to a camp and it shows up when that camp is filtered; leave it loose for the
              jobs that are nobody&apos;s camp in particular.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">What needs doing</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Detail</Label>
              <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Camp</Label>
                <Select
                  value={eventId || "none"}
                  onValueChange={(v) => setEventId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not tied to a camp</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Who</Label>
                <Select
                  value={assignee || "none"}
                  onValueChange={(v) => setAssignee(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nobody yet</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Due</Label>
                <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block">Column</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : task ? "Save" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
