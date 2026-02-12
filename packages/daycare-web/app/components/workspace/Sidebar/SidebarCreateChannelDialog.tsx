import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Hash, Lock } from "lucide-react";

export function SidebarCreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
  mutate,
  api,
  token,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
  mutate: (name: "channelCreate", input: { id: string; name: string; topic?: string | null; visibility?: "public" | "private" }) => void;
  api: { channelCreate: (token: string, orgId: string, input: { name: string; topic?: string | null; visibility?: "public" | "private" }) => Promise<{ channel: { id: string } }> };
  token: string;
  orgId: string;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { channel } = await api.channelCreate(token, orgId, {
        name: name.trim(),
        topic: topic.trim() || null,
        visibility,
      });
      onCreated(channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setTopic("");
      setVisibility("public");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create Channel</DialogTitle>
          <DialogDescription>
            Add a new channel to your workspace
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="channel-name" className="text-sm font-medium">
              Channel name
            </label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="general"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="channel-topic" className="text-sm font-medium">
              Topic (optional)
            </label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setVisibility("public")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "public"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                <Hash className="h-4 w-4" />
                Public
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setVisibility("private")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "private"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                <Lock className="h-4 w-4" />
                Private
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {visibility === "public"
                ? "Anyone in the organization can join this channel."
                : "Only invited members can see and join this channel."}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
