import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./compontnes/Button";
import { Card } from "./compontnes/Card";
import { Field } from "./compontnes/Field";
import { Input } from "./compontnes/Input";
import { Modal } from "./compontnes/Modal";
import { Nav } from "./compontnes/Nav";
import { Pill } from "./compontnes/Pill";
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

function DaycareApp(): JSX.Element {
  const app = daycareAppUse();
  const [orgName, orgNameSet] = useState("New Tactical Org");
  const [orgSlug, orgSlugSet] = useState(slugFromName("New Tactical Org"));
  const [orgFirstName, orgFirstNameSet] = useState("Operator");
  const [orgUsername, orgUsernameSet] = useState("operator");
  const [channelName, channelNameSet] = useState("delivery");
  const [orgModalOpen, orgModalOpenSet] = useState(false);
  const [channelModalOpen, channelModalOpenSet] = useState(false);

  const selectedChannel = useMemo(() => {
    return app.channels.find((channel) => channel.id === app.selectedChannelId) ?? null;
  }, [app.channels, app.selectedChannelId]);

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

  return (
    <div className="daycare-shell">
      <div className="daycare-grain" />
      <main className="daycare-main">
        <Nav
          title="Daycare"
          subtitle="IRC/SaaS hybrid interface with real sync"
          left={<span className="brand-dot">DC</span>}
          right={
            <div className="nav-actions">
              <Pill tone={app.syncState === "live" ? "success" : app.syncState === "recovering" ? "danger" : "neutral"}>
                {app.syncState} #{app.syncOffset}
              </Pill>
              {app.phase === "workspace" ? (
                <Button variant="ghost" size="sm" onClick={() => void app.logout()}>
                  Logout
                </Button>
              ) : null}
            </div>
          }
        />

        {app.error ? (
          <Card tone="ghost" className="error-banner">
            {app.error}
          </Card>
        ) : null}

        {app.phase === "auth" ? (
          <Card className="auth-panel">
            <div>
              <h2>Login</h2>
              <p className="muted">Development login uses email only.</p>
            </div>
            <Field label="Email">
              <Input value={app.email} onChange={(event) => app.emailSet(event.target.value)} placeholder="you@company.com" />
            </Field>
            <Button disabled={app.busy || app.email.trim().length === 0} onClick={() => void app.login()}>
              Continue
            </Button>
          </Card>
        ) : null}

        {app.phase === "orgs" ? (
          <Card className="orgs-panel">
            <div className="orgs-header">
              <div>
                <h2>Organizations</h2>
                <p className="muted">Pick a workspace or create a new one.</p>
              </div>
              <Button size="sm" onClick={() => orgModalOpenSet(true)}>
                Create Organization
              </Button>
            </div>
            <div className="org-grid">
              {app.orgs.map((org) => (
                <Card key={org.id} className="org-card" tone="surface">
                  <h3>{org.name}</h3>
                  <p className="muted">/{org.slug}</p>
                  <Button disabled={app.busy} onClick={() => void app.organizationOpen(org.id)}>
                    Open
                  </Button>
                </Card>
              ))}
            </div>
          </Card>
        ) : null}

        {app.phase === "workspace" ? (
          <section className="workspace">
            <Card className="workspace-rail">
              <div className="rail-dot">
                {(app.activeOrganization?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <Button variant="ghost" size="sm" onClick={() => orgModalOpenSet(true)}>
                +
              </Button>
            </Card>

            <Card className="sidebar">
              <div className="sidebar-head">
                <h2>{app.activeOrganization?.name ?? "Organization"}</h2>
                <p className="muted">@{app.activeUser?.username}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => channelModalOpenSet(true)}>
                New Channel
              </Button>
              <nav className="channel-list">
                {app.channels.map((channel) => {
                  const selected = channel.id === app.selectedChannelId;
                  const unread = app.readStatesByChannelId[channel.id]?.unreadCount ?? 0;
                  const slug = slugFromName(channel.name);
                  return (
                    <Button
                      key={channel.id}
                      variant={selected ? "primary" : "ghost"}
                      size="sm"
                      className="channel"
                      onClick={() => void app.channelSelect(channel.id)}
                    >
                      <span>#{slug || channel.name}</span>
                      {unread > 0 ? <Pill tone="accent">{unread}</Pill> : null}
                    </Button>
                  );
                })}
              </nav>
            </Card>

            <Card className="chat">
              <div className="chat-head">
                <div>
                  <h2>#{slugFromName(selectedChannel?.name ?? "channel")}</h2>
                  <p className="muted">{selectedChannel?.topic ?? "No topic"}</p>
                </div>
                <div className="chat-meta">
                  <Pill tone={app.syncState === "live" ? "success" : "neutral"}>{app.syncState}</Pill>
                </div>
              </div>
              <div className="message-list">
                {app.rootMessages.map((item) => {
                  const mine = item.authorId === app.activeUser?.id;
                  const reacted = item.reactions.some(
                    (reaction) => reaction.shortcode === ":fire:" && reaction.userIds.includes(app.activeUser?.id ?? "")
                  );
                  return (
                    <article key={item.id} className={mine ? "message mine" : "message"}>
                      <div className="message-meta">
                        <strong>{item.author.firstName}</strong>
                        <span>@{item.author.username}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                        {item.pending ? <Pill tone="accent">sending</Pill> : null}
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
                <Button disabled={app.busy || app.composerText.trim().length === 0} onClick={() => void app.messageSend()}>
                  Send
                </Button>
              </div>
            </Card>

            <Card className="thread">
              <div className="thread-head">
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
              {app.activeThreadRootId ? (
                <div className="thread-list">
                  {app.threadMessages.map((item) => (
                    <article key={item.id} className="message thread-message">
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
            </Card>
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
