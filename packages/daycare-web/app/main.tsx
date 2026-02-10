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

function DaycareApp(): JSX.Element {
  const app = daycareAppUse();
  const [orgName, orgNameSet] = useState("New Tactical Org");
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
      .map((typing) => app.membersById[typing.userId]?.firstName ?? app.membersById[typing.userId]?.username ?? "Someone")
      .slice(0, 3);
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    }
    return `${names.join(", ")} are typing...`;
  }, [app.membersById, app.typingInSelected]);

  return (
    <div className="daycare-shell">
      <div className="daycare-grain" />
      <main className="daycare-main">
        <Nav
          title="Daycare"
          subtitle="Mocked Tactical/Happy-style sync lab"
          left={<span className="brand-dot">DC</span>}
          right={
            <div className="nav-actions">
              <Pill tone={app.syncState === "live" ? "success" : app.syncState === "recovering" ? "danger" : "neutral"}>
                {app.syncState} #{app.syncOffset}
              </Pill>
              {app.phase === "workspace" ? (
                <Button variant="ghost" size="sm" onClick={() => void app.holeSimulate()}>
                  Simulate Stream Hole
                </Button>
              ) : null}
              {app.phase !== "auth" ? (
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
              <h2>Authentication</h2>
              <p className="muted">Use email OTP flow. In mock mode OTP is always `111111`.</p>
            </div>
            <Field label="Email">
              <Input value={app.email} onChange={(event) => app.emailSet(event.target.value)} placeholder="you@company.com" />
            </Field>
            <div className="row">
              <Button disabled={app.busy} onClick={() => void app.requestOtp()}>
                Request OTP
              </Button>
              <Field label="OTP" inline>
                <Input
                  value={app.otp}
                  onChange={(event) => app.otpSet(event.target.value)}
                  placeholder="111111"
                  maxLength={6}
                />
              </Field>
              <Button disabled={app.busy || !app.otpRequested} onClick={() => void app.verifyOtp()}>
                Continue
              </Button>
            </div>
            <p className="muted">{app.otpRequested ? "OTP sent. Use 111111." : "Request OTP first."}</p>
          </Card>
        ) : null}

        {app.phase === "orgs" ? (
          <Card className="orgs-panel">
            <div className="orgs-header">
              <div>
                <h2>Organizations</h2>
                <p className="muted">Choose an org or spin up a new one.</p>
              </div>
              <Button size="sm" onClick={() => orgModalOpenSet(true)}>
                Create Organization
              </Button>
            </div>
            <div className="org-grid">
              {app.organizations.map((card) => (
                <Card key={card.organization.id} className="org-card" tone="surface">
                  <h3>{card.organization.name}</h3>
                  <p className="muted">/{card.organization.slug}</p>
                  <p>{card.membership ? `Member as @${card.user?.username ?? "unknown"}` : "Not joined yet"}</p>
                  <Button disabled={app.busy} onClick={() => void app.organizationOpen(card.organization.id)}>
                    {card.membership ? "Open" : "Join + Open"}
                  </Button>
                </Card>
              ))}
            </div>
          </Card>
        ) : null}

        {app.phase === "workspace" ? (
          <section className="workspace">
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
                  return (
                    <Button
                      key={channel.id}
                      variant={selected ? "primary" : "ghost"}
                      size="sm"
                      className="channel"
                      onClick={() => void app.channelSelect(channel.id)}
                    >
                      <span>#{channel.slug}</span>
                      {unread > 0 ? <Pill tone="accent">{unread}</Pill> : null}
                    </Button>
                  );
                })}
              </nav>
            </Card>

            <Card className="chat">
              <div className="chat-head">
                <div>
                  <h2>#{selectedChannel?.slug ?? "channel"}</h2>
                  <p className="muted">{selectedChannel?.topic ?? "No topic"}</p>
                </div>
                <div className="chat-meta">
                  <Pill tone={app.syncState === "live" ? "success" : "neutral"}>{app.syncState}</Pill>
                </div>
              </div>
              <div className="message-list">
                {app.rootMessages.map((item) => {
                  const mine = item.message.authorId === app.activeUser?.id;
                  const reacted = item.message.reactions.some(
                    (reaction) => reaction.shortcode === ":fire:" && reaction.userIds.includes(app.activeUser?.id ?? "")
                  );
                  return (
                    <article key={item.message.id} className={mine ? "message mine" : "message"}>
                      <div className="message-meta">
                        <strong>{item.author.firstName}</strong>
                        <span>@{item.author.username}</span>
                        <span>{new Date(item.message.createdAt).toLocaleTimeString()}</span>
                        {item.message.id.startsWith("optimistic_") ? <Pill tone="accent">sending</Pill> : null}
                      </div>
                      <p>{item.message.text}</p>
                      <div className="message-actions">
                        <Button variant="ghost" size="sm" onClick={() => void app.reactionToggle(item.message.id, ":fire:")}>
                          {reacted ? "Fire" : "React"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void app.threadOpen(item.message.id)}>
                          Thread {item.message.threadReplyCount > 0 ? `(${item.message.threadReplyCount})` : ""}
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
                    <article key={item.message.id} className="message thread-message">
                      <div className="message-meta">
                        <strong>{item.author.firstName}</strong>
                        <span>@{item.author.username}</span>
                      </div>
                      <p>{item.message.text}</p>
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
        subtitle="Spin up a new workspace and open it immediately."
        onClose={() => orgModalOpenSet(false)}
        footer={
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => orgModalOpenSet(false)}>
              Cancel
            </Button>
            <Button
              disabled={app.busy || orgName.trim().length < 2}
              onClick={() => void app.organizationCreate(orgName).then(() => orgModalOpenSet(false))}
            >
              Create + Open
            </Button>
          </div>
        }
      >
        <Field label="Organization name" hint="Use a short, memorable label.">
          <Input value={orgName} onChange={(event) => orgNameSet(event.target.value)} placeholder="Acme AI Guild" />
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
              onClick={() => void app.channelCreate(channelName).then(() => channelModalOpenSet(false))}
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
