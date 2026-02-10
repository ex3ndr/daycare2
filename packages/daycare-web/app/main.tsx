import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Avatar } from "./compontnes/Avatar";
import { Badge } from "./compontnes/Badge";
import { Button } from "./compontnes/Button";
import { Card } from "./compontnes/Card";
import { Field } from "./compontnes/Field";
import { IconButton } from "./compontnes/IconButton";
import { Input } from "./compontnes/Input";
import { ListRow } from "./compontnes/ListRow";
import { Modal } from "./compontnes/Modal";
import { Nav } from "./compontnes/Nav";
import { SectionHeader } from "./compontnes/SectionHeader";
import { Textarea } from "./compontnes/Textarea";
import { daycareAppUse } from "./daycare/ui/daycareAppUse";
import "./styles.css";

const slugFromName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit"
});

function DaycareApp(): JSX.Element {
  const app = daycareAppUse();
  const [orgName, orgNameSet] = useState("Daycare Ops");
  const [orgSlug, orgSlugSet] = useState(slugFromName("Daycare Ops"));
  const [orgFirstName, orgFirstNameSet] = useState("Operator");
  const [orgUsername, orgUsernameSet] = useState("operator");
  const [channelName, channelNameSet] = useState("mission-briefs");
  const [orgModalOpen, orgModalOpenSet] = useState(false);
  const [channelModalOpen, channelModalOpenSet] = useState(false);

  const selectedChannel = useMemo(() => {
    return app.channels.find((channel) => channel.id === app.selectedChannelId) ?? null;
  }, [app.channels, app.selectedChannelId]);

  const threadRoot = useMemo(() => {
    if (!app.activeThreadRootId) {
      return null;
    }
    return app.rootMessages.find((message) => message.id === app.activeThreadRootId) ?? null;
  }, [app.activeThreadRootId, app.rootMessages]);

  const typingLabel = useMemo(() => {
    if (app.typingInSelected.length === 0) {
      return null;
    }
    const names = app.typingInSelected
      .map((typing) => typing.firstName || typing.username)
      .slice(0, 3);
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    }
    return `${names.join(", ")} are typing...`;
  }, [app.typingInSelected]);

  const syncTone = app.syncState === "live" ? "success" : app.syncState === "recovering" ? "danger" : "neutral";

  return (
    <div className="daycare-shell">
      <div className="daycare-grain" />
      <main className="daycare-main">
        {app.phase !== "workspace" ? (
          <Nav
            title="Daycare"
            subtitle="IRC/SaaS hybrid interface with real-time sync"
            left={<span className="brand-dot">DC</span>}
            right={
              <div className="nav-actions">
                <Badge tone={syncTone}>{app.syncState}</Badge>
              </div>
            }
          />
        ) : null}

        {app.error ? (
          <Card tone="ghost" className="error-banner">
            {app.error}
          </Card>
        ) : null}

        {app.phase === "auth" ? (
          <Card className="auth-panel">
            <div className="auth-panel-grid">
              <div className="auth-panel-left">
                <h2>Welcome back</h2>
                <p className="muted">
                  Sign in with your email to join the live tactical workspace. The API is live and updates stream in
                  real time.
                </p>
                <div className="auth-chip-row">
                  <Badge tone="accent">SSE</Badge>
                  <Badge tone="neutral">Threads</Badge>
                  <Badge tone="neutral">Typing</Badge>
                </div>
              </div>
              <div className="auth-panel-right">
                <Field label="Email">
                  <Input
                    value={app.email}
                    onChange={(event) => app.emailSet(event.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                <Button disabled={app.busy || app.email.trim().length === 0} onClick={() => void app.login()}>
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {app.phase === "orgs" ? (
          <Card className="orgs-panel">
            <div className="orgs-header">
              <div>
                <h2>Workspaces</h2>
                <p className="muted">Pick a workspace or create a new one.</p>
              </div>
              <Button size="sm" onClick={() => orgModalOpenSet(true)}>
                New Workspace
              </Button>
            </div>
            <div className="org-list">
              {app.orgs.map((org) => (
                <button key={org.id} className="org-item" onClick={() => void app.organizationOpen(org.id)}>
                  <Avatar name={org.name} size="md" tone="accent" />
                  <div className="org-item-body">
                    <strong>{org.name}</strong>
                    <span>/{org.slug}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {app.phase === "workspace" ? (
          <section className="workspace-layout">
            <div className="panel rail-panel">
              <div className="rail-stack">
                <Avatar name="Daycare" size="sm" tone="accent" />
                <div className="rail-divider" />
                <button className="rail-org" onClick={() => orgModalOpenSet(true)}>
                  {(app.activeOrganization?.name ?? "?").slice(0, 1).toUpperCase()}
                </button>
                <IconButton
                  tone="ghost"
                  size="sm"
                  aria-label="Create org"
                  onClick={() => orgModalOpenSet(true)}
                >
                  +
                </IconButton>
              </div>
              <div className="rail-footer">
                <IconButton tone="ghost" size="sm" aria-label="Logout" onClick={() => void app.logout()}>
                  ↩
                </IconButton>
              </div>
            </div>

            <div className="panel sidebar-panel">
              <div className="sidebar-header">
                <div>
                  <h2>{app.activeOrganization?.name ?? "Organization"}</h2>
                  <div className="sidebar-user">
                    <Avatar
                      name={app.activeUser?.firstName ?? app.activeUser?.username ?? "User"}
                      size="xs"
                      tone="ghost"
                    />
                    <span>
                      {app.activeUser?.firstName ?? "User"} · @{app.activeUser?.username ?? "unknown"}
                    </span>
                  </div>
                </div>
                <IconButton tone="ghost" size="sm" aria-label="New channel" onClick={() => channelModalOpenSet(true)}>
                  +
                </IconButton>
              </div>

              <SectionHeader title="Channels" meta={`${app.channels.length}`} />
              <nav className="channel-list">
                {app.channels.map((channel) => {
                  const selected = channel.id === app.selectedChannelId;
                  const unread = app.readStatesByChannelId[channel.id]?.unreadCount ?? 0;
                  const slug = slugFromName(channel.name);
                  return (
                    <ListRow
                      key={channel.id}
                      title={`#${slug || channel.name}`}
                      subtitle={channel.topic ?? "No topic"}
                      active={selected}
                      trailing={unread > 0 ? <Badge tone="accent" size="sm">{unread}</Badge> : null}
                      onClick={() => void app.channelSelect(channel.id)}
                    />
                  );
                })}
              </nav>

              <SectionHeader title="Direct" meta="Soon" />
              <div className="sidebar-empty">Direct messages will appear here.</div>
            </div>

            <div className="panel chat-panel">
              <div className="chat-header">
                <div>
                  <div className="chat-title">
                    <span className="chat-title-hash">#</span>
                    <span>{slugFromName(selectedChannel?.name ?? "channel")}</span>
                  </div>
                  <p className="muted">{selectedChannel?.topic ?? "No topic"}</p>
                </div>
                <div className="chat-actions">
                  <Badge tone={syncTone}>sync {app.syncState}</Badge>
                  <Badge tone="neutral">#{app.syncOffset}</Badge>
                </div>
              </div>

              <div className="message-list">
                {app.rootMessages.map((item) => {
                  const mine = item.authorId === app.activeUser?.id;
                  const reacted = item.reactions.some(
                    (reaction) => reaction.shortcode === ":fire:" && reaction.userIds.includes(app.activeUser?.id ?? "")
                  );
                  return (
                    <article key={item.id} className={mine ? "message-row mine" : "message-row"}>
                      <Avatar name={item.author.firstName} size="sm" tone={mine ? "accent" : "ghost"} />
                      <div className="message-body">
                        <div className="message-meta">
                          <strong>{item.author.firstName}</strong>
                          <span className="message-handle">@{item.author.username}</span>
                          <span className="message-time">{timeFormatter.format(new Date(item.createdAt))}</span>
                          {item.pending ? <Badge tone="accent" size="sm">sending</Badge> : null}
                        </div>
                        <p>{item.text}</p>
                        <div className="message-actions">
                          <Button variant="ghost" size="sm" onClick={() => void app.reactionToggle(item.id, ":fire:")}>
                            {reacted ? "Fire" : "React"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void app.threadOpen(item.id)}>
                            Thread {item.threadReplyCount > 0 ? `(${item.threadReplyCount})` : ""}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="typing-line">
                {typingLabel ? <span>{typingLabel}</span> : <span className="muted">No one typing</span>}
              </div>

              <div className="composer">
                <Textarea
                  value={app.composerText}
                  onChange={(event) => app.composerTextSet(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void app.messageSend();
                    }
                  }}
                  placeholder={
                    app.activeThreadRootId
                      ? "Reply in thread. Enter to send."
                      : "Message channel. Enter to send, Shift+Enter newline."
                  }
                />
                <Button
                  variant="primary"
                  disabled={app.busy || app.composerText.trim().length === 0}
                  onClick={() => void app.messageSend()}
                >
                  Send
                </Button>
              </div>
            </div>

            <div className={app.activeThreadRootId ? "panel thread-panel" : "panel thread-panel thread-panel-empty"}>
              <div className="thread-header">
                <div>
                  <h3>{app.activeThreadRootId ? "Thread" : "Thread Closed"}</h3>
                  <p className="muted">Replies stay in this panel.</p>
                </div>
                {app.activeThreadRootId ? (
                  <Button variant="ghost" size="sm" onClick={app.threadClose}>
                    Close
                  </Button>
                ) : null}
              </div>
              {threadRoot ? (
                <div className="thread-root">
                  <strong>{threadRoot.author.firstName}</strong>
                  <span>@{threadRoot.author.username}</span>
                  <p>{threadRoot.text}</p>
                </div>
              ) : null}
              {app.activeThreadRootId ? (
                <div className="thread-list">
                  {app.threadMessages.map((item) => (
                    <article key={item.id} className="thread-message">
                      <div className="message-meta">
                        <strong>{item.author.firstName}</strong>
                        <span>@{item.author.username}</span>
                      </div>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Open a message thread to view and reply here.</p>
              )}
            </div>
          </section>
        ) : null}
      </main>

      <Modal
        open={orgModalOpen}
        title="Create Organization"
        subtitle="Create a new workspace with your user profile."
        onClose={() => orgModalOpenSet(false)}
        footer={
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => orgModalOpenSet(false)}>
              Cancel
            </Button>
            <Button
              disabled={app.busy || orgName.trim().length < 2 || orgSlug.trim().length < 2}
              onClick={() =>
                void app
                  .organizationCreate({
                    name: orgName,
                    slug: orgSlug,
                    firstName: orgFirstName,
                    username: orgUsername
                  })
                  .then(() => orgModalOpenSet(false))
              }
            >
              Create + Open
            </Button>
          </div>
        }
      >
        <Field label="Organization name" hint="Readable name for the workspace.">
          <Input
            value={orgName}
            onChange={(event) => {
              const value = event.target.value;
              orgNameSet(value);
              orgSlugSet(slugFromName(value));
            }}
            placeholder="Acme AI Guild"
          />
        </Field>
        <Field label="Slug" hint="Lowercase, kebab-case in URLs.">
          <Input value={orgSlug} onChange={(event) => orgSlugSet(event.target.value)} placeholder="acme-ai" />
        </Field>
        <Field label="First name">
          <Input value={orgFirstName} onChange={(event) => orgFirstNameSet(event.target.value)} placeholder="Operator" />
        </Field>
        <Field label="Username" hint="Visible handle in chat.">
          <Input value={orgUsername} onChange={(event) => orgUsernameSet(event.target.value)} placeholder="operator" />
        </Field>
      </Modal>

      <Modal
        open={channelModalOpen}
        title="Create Channel"
        subtitle="New channels are instantly available to all members."
        onClose={() => channelModalOpenSet(false)}
        footer={
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => channelModalOpenSet(false)}>
              Cancel
            </Button>
            <Button
              disabled={app.busy || channelName.trim().length < 2}
              onClick={() => void app.channelCreate({ name: channelName }).then(() => channelModalOpenSet(false))}
            >
              Create Channel
            </Button>
          </div>
        }
      >
        <Field label="Channel name" hint="Lowercase, hyphenated works best.">
          <Input value={channelName} onChange={(event) => channelNameSet(event.target.value)} placeholder="delivery" />
        </Field>
      </Modal>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DaycareApp />
  </StrictMode>
);
