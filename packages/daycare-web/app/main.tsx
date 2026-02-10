import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { daycareAppUse } from "./daycare/ui/daycareAppUse";
import "./styles.css";

function DaycareApp(): JSX.Element {
  const app = daycareAppUse();
  const [orgName, orgNameSet] = useState("New Tactical Org");
  const [channelName, channelNameSet] = useState("delivery");

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
        <header className="daycare-header">
          <h1>Daycare</h1>
          <div className="daycare-subhead">
            <span>Mocked Tactical/Happy-style sync lab</span>
            <span className={`sync-badge sync-${app.syncState}`}>
              {app.syncState} #{app.syncOffset}
            </span>
          </div>
        </header>

        {app.error ? <p className="error-banner">{app.error}</p> : null}

        {app.phase === "auth" ? (
          <section className="panel auth-panel">
            <div>
              <h2>Authentication</h2>
              <p>Use email OTP flow. In mock mode OTP is always `111111`.</p>
            </div>
            <label className="field">
              <span>Email</span>
              <input value={app.email} onChange={(event) => app.emailSet(event.target.value)} placeholder="you@company.com" />
            </label>
            <div className="row">
              <button disabled={app.busy} onClick={() => void app.requestOtp()}>
                Request OTP
              </button>
              <label className="field field-inline">
                <span>OTP</span>
                <input
                  value={app.otp}
                  onChange={(event) => app.otpSet(event.target.value)}
                  placeholder="111111"
                  maxLength={6}
                />
              </label>
              <button disabled={app.busy || !app.otpRequested} onClick={() => void app.verifyOtp()}>
                Continue
              </button>
            </div>
            <p className="muted">{app.otpRequested ? "OTP sent. Use 111111." : "Request OTP first."}</p>
          </section>
        ) : null}

        {app.phase === "orgs" ? (
          <section className="panel orgs-panel">
            <div className="orgs-header">
              <h2>Organizations</h2>
              <button onClick={() => void app.logout()}>Logout</button>
            </div>
            <div className="row">
              <label className="field grow">
                <span>Create Organization</span>
                <input
                  value={orgName}
                  onChange={(event) => orgNameSet(event.target.value)}
                  placeholder="Acme AI Guild"
                />
              </label>
              <button disabled={app.busy || orgName.trim().length < 2} onClick={() => void app.organizationCreate(orgName)}>
                Create + Open
              </button>
            </div>
            <div className="org-grid">
              {app.organizations.map((card) => (
                <article key={card.organization.id} className="org-card">
                  <h3>{card.organization.name}</h3>
                  <p className="muted">/{card.organization.slug}</p>
                  <p>{card.membership ? `Member as @${card.user?.username ?? "unknown"}` : "Not joined yet"}</p>
                  <button disabled={app.busy} onClick={() => void app.organizationOpen(card.organization.id)}>
                    {card.membership ? "Open" : "Join + Open"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {app.phase === "workspace" ? (
          <section className="workspace">
            <aside className="panel sidebar">
              <div className="sidebar-head">
                <h2>{app.activeOrganization?.name ?? "Organization"}</h2>
                <p className="muted">@{app.activeUser?.username}</p>
              </div>
              <div className="row compact">
                <input
                  value={channelName}
                  onChange={(event) => channelNameSet(event.target.value)}
                  placeholder="new-channel"
                />
                <button disabled={app.busy || channelName.trim().length < 2} onClick={() => void app.channelCreate(channelName)}>
                  +
                </button>
              </div>
              <nav className="channel-list">
                {app.channels.map((channel) => {
                  const selected = channel.id === app.selectedChannelId;
                  const unread = app.readStatesByChannelId[channel.id]?.unreadCount ?? 0;
                  return (
                    <button
                      key={channel.id}
                      className={selected ? "channel selected" : "channel"}
                      onClick={() => void app.channelSelect(channel.id)}
                    >
                      <span>#{channel.slug}</span>
                      {unread > 0 ? <span className="pill">{unread}</span> : null}
                    </button>
                  );
                })}
              </nav>
              <div className="sidebar-actions">
                <button onClick={() => void app.holeSimulate()}>Simulate Stream Hole</button>
                <button onClick={() => void app.logout()}>Logout</button>
              </div>
            </aside>

            <section className="panel chat">
              <div className="chat-head">
                <h2>#{selectedChannel?.slug ?? "channel"}</h2>
                <p className="muted">{selectedChannel?.topic ?? "No topic"}</p>
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
                        {item.message.id.startsWith("optimistic_") ? <span className="pill">sending…</span> : null}
                      </div>
                      <p>{item.message.text}</p>
                      <div className="message-actions">
                        <button onClick={() => void app.reactionToggle(item.message.id, ":fire:")}>
                          {reacted ? "🔥 reacted" : "🔥 react"}
                        </button>
                        <button onClick={() => void app.threadOpen(item.message.id)}>
                          Thread {item.message.threadReplyCount > 0 ? `(${item.message.threadReplyCount})` : ""}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {typingLabel ? <p className="typing-line">{typingLabel}</p> : <p className="typing-line muted">No one typing</p>}
              <div className="composer">
                <textarea
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
                <button disabled={app.busy || app.composerText.trim().length === 0} onClick={() => void app.messageSend()}>
                  Send
                </button>
              </div>
            </section>

            <aside className="panel thread">
              <div className="thread-head">
                <h3>{app.activeThreadRootId ? "Thread" : "Thread Closed"}</h3>
                {app.activeThreadRootId ? <button onClick={app.threadClose}>Close</button> : null}
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
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DaycareApp />
  </StrictMode>
);
