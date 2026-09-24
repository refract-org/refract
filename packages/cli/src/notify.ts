export interface NotifyConfig {
  slack?: boolean;
  email?: boolean;
  webhookUrl?: string;
}

export interface DeltaNotification {
  pageTitle: string;
  eventsNew: number;
  eventsResolved: number;
  deltaSummary: string;
  wikiUrl?: string;
}

export async function sendNotifications(config: NotifyConfig, deltas: DeltaNotification[]): Promise<void> {
  if (deltas.length === 0) return;

  const changedDeltas = deltas.filter((d) => d.eventsNew > 0 || d.eventsResolved > 0);
  if (changedDeltas.length === 0) return;

  const promises: Promise<void>[] = [];

  if (config.slack) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      promises.push(sendSlackNotification(webhookUrl, changedDeltas));
    } else {
      console.error("Slack notification requested but SLACK_WEBHOOK_URL not set.");
    }
  }

  if (config.email) {
    promises.push(sendEmailNotification(changedDeltas));
  }

  if (config.webhookUrl) {
    promises.push(sendWebhookNotification(config.webhookUrl, changedDeltas));
  }

  await Promise.allSettled(promises);
}

function formatSlackMessage(deltas: DeltaNotification[]): string {
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Refract observation report" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${deltas.length} page(s) changed since last observation.`,
      },
    },
    { type: "divider" },
  ];

  for (const d of deltas) {
    const summary =
      d.eventsNew > 0 ? `${d.eventsNew} new event(s), ${d.eventsResolved} resolved` : `${d.eventsResolved} resolved`;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${d.pageTitle}*\n${summary}\n${d.eventsNew > 0 ? "Changes detected" : "Resolved"}`,
      },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Generated at ${new Date().toISOString()} · <https://github.com/refract-org/refract|Refract>`,
        },
      ],
    },
  );

  return JSON.stringify({ blocks });
}

async function sendSlackNotification(webhookUrl: string, deltas: DeltaNotification[]): Promise<void> {
  const body = formatSlackMessage(deltas);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "unknown");
    console.error(`Slack notification failed: ${response.status} ${err.slice(0, 200)}`);
  }
}

async function sendEmailNotification(deltas: DeltaNotification[]): Promise<void> {
  const subject = `Refract: ${deltas.length} page(s) changed`;
  const body = deltas
    .map((d) => {
      const summary =
        d.eventsNew > 0 ? `${d.eventsNew} new, ${d.eventsResolved} resolved` : `${d.eventsResolved} resolved`;
      return `${d.pageTitle}: ${summary}${d.wikiUrl ? ` (${d.wikiUrl})` : ""}`;
    })
    .join("\n");

  const fullBody = `${body}\n\nGenerated at ${new Date().toISOString()}`;

  const sendmail = process.env.SMTP_SENDMAIL ?? "/usr/sbin/sendmail";
  const recipient = process.env.SMTP_TO;

  if (!recipient) {
    console.error("Email notification requested but SMTP_TO not set.");
    return;
  }

  try {
    const { execFile } = await import("node:child_process");
    const mailInput = `To: ${recipient}\nSubject: ${subject}\n\n${fullBody}`;
    execFile(sendmail, ["-t"], (error) => {
      if (error) {
        console.error(`Email notification failed: ${error.message}`);
      }
    })?.stdin?.end(mailInput);
  } catch (err) {
    console.error(`Email notification failed: ${(err as Error).message}`);
  }
}

async function sendWebhookNotification(webhookUrl: string, deltas: DeltaNotification[]): Promise<void> {
  const payload = {
    event: "refract.observation",
    pages: deltas,
    totalNewEvents: deltas.reduce((s, d) => s + d.eventsNew, 0),
    totalResolved: deltas.reduce((s, d) => s + d.eventsResolved, 0),
    generatedAt: new Date().toISOString(),
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "unknown");
    console.error(`Webhook notification failed: ${response.status} ${err.slice(0, 200)}`);
  }
}
