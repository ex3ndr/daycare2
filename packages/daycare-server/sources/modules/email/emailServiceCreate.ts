import { getLogger } from "@/utils/getLogger.js";

export type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailService = {
  send: (input: EmailSendInput) => Promise<void>;
};

export type EmailServiceConfig = {
  apiKey?: string;
  from?: string;
  nodeEnv: "development" | "test" | "production";
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailServiceCreate(config: EmailServiceConfig): EmailService {
  const logger = getLogger("email.service");

  if (config.nodeEnv === "production" && (!config.apiKey || !config.from)) {
    throw new Error("Resend credentials are required in production");
  }

  if (!config.apiKey || !config.from) {
    return {
      send: async (input) => {
        logger.warn("email disabled; skipping send", {
          to: input.to,
          subject: input.subject
        });
      }
    };
  }

  return {
    send: async (input) => {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: config.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("resend failed", {
          status: response.status,
          body: errorBody.slice(0, 500)
        });
        throw new Error("Failed to send email");
      }
    }
  };
}
