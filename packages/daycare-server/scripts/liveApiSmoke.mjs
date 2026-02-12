import { createId } from "@paralleldrive/cuid2";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fail(message) {
  throw new Error(message);
}

async function jsonRequest(baseUrl, path, options = {}) {
  const method = options.method ?? "GET";
  const headers = {
    ...(options.headers ?? {})
  };
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  if (body !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body
  });

  const text = await response.text();
  let payload = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      fail(`${method} ${path} returned non-JSON payload: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok) {
    fail(`${method} ${path} failed with ${response.status}: ${text.slice(0, 400)}`);
  }

  return payload;
}

async function waitForReady(baseUrl) {
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const payload = await jsonRequest(baseUrl, "/health/ready");
      if (payload && payload.ok === true) {
        return;
      }
    } catch {
      // Keep polling.
    }
    await sleep(1000);
  }

  fail(`Live server was not ready within ${maxAttempts} seconds`);
}

async function run() {
  const baseUrl = process.env.LIVE_SERVER_URL ?? "http://api:3005";
  const unique = Date.now().toString(36);
  const email = `docker-smoke-${unique}@example.com`;
  const slug = `docker-smoke-${unique}`;
  const username = `smoke${unique}`.slice(0, 32);

  await waitForReady(baseUrl);

  const loginPayload = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: {
      email
    }
  });

  if (!loginPayload?.ok || !loginPayload?.data?.token) {
    fail("Login response is missing token");
  }

  const token = loginPayload.data.token;
  const authHeaders = {
    authorization: `Bearer ${token}`
  };

  const mePayload = await jsonRequest(baseUrl, "/api/me", {
    headers: authHeaders
  });
  if (!mePayload?.ok || !mePayload?.data?.account?.id) {
    fail("/api/me response is invalid");
  }

  const orgPayload = await jsonRequest(baseUrl, "/api/org/create", {
    method: "POST",
    headers: authHeaders,
    body: {
      slug,
      name: `Docker Smoke ${unique}`,
      firstName: "Smoke",
      username
    }
  });

  if (!orgPayload?.ok || !orgPayload?.data?.organization?.id) {
    fail("/api/org/create response is invalid");
  }

  const orgId = orgPayload.data.organization.id;

  const channelPayload = await jsonRequest(baseUrl, `/api/org/${orgId}/channels`, {
    method: "POST",
    headers: authHeaders,
    body: {
      name: "smoke",
      visibility: "public"
    }
  });

  if (!channelPayload?.ok || !channelPayload?.data?.channel?.id) {
    fail("Channel creation response is invalid");
  }

  const channelId = channelPayload.data.channel.id;

  const messagePayload = await jsonRequest(baseUrl, `/api/org/${orgId}/messages/send`, {
    method: "POST",
    headers: authHeaders,
    body: {
      messageId: createId(),
      channelId,
      text: "docker smoke test"
    }
  });

  if (!messagePayload?.ok || !messagePayload?.data?.message?.id) {
    fail("Message send response is invalid");
  }

  console.log("Live API smoke checks passed.");
}

await run();
