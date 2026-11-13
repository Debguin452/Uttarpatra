const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const WHATSAPP_ALERT_URL = process.env.WHATSAPP_ALERT_URL;

const WORKER_SCRIPT_NAME = process.env.WORKER_SCRIPT_NAME || "coaching-api";
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "0aebc296-b47b-4f38-bbbe-57f8bbe622ba";

// Cloudflare free-plan daily caps as documented at the time this was written.
// Verify against the current numbers on your account's Workers and D1
// dashboard pages before trusting these for anything safety-critical.
const CAPS = {
  workersRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
};

const THRESHOLDS = [
  { level: 0.9, label: "90%" },
  { level: 0.7, label: "70%" },
];

function todayRangeUTC() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: start.toISOString().slice(0, 10), now };
}

async function graphql(query, variables) {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${CF_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) {
    throw new Error(`Cloudflare GraphQL error: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data;
}

async function fetchWorkersRequests(date) {
  const query = `
    query ($accountTag: String!, $date: Date!, $scriptName: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 1
            filter: { date: $date, scriptName: $scriptName }
          ) {
            sum { requests }
          }
        }
      }
    }
  `;
  const data = await graphql(query, {
    accountTag: CF_ACCOUNT_ID,
    date,
    scriptName: WORKER_SCRIPT_NAME,
  });
  const rows = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  return rows.reduce((total, row) => total + (row.sum?.requests ?? 0), 0);
}

async function fetchD1Usage(date) {
  const query = `
    query ($accountTag: String!, $date: Date!, $databaseId: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            limit: 1000
            filter: { date: $date, databaseId: $databaseId }
          ) {
            sum { rowsRead rowsWritten }
          }
        }
      }
    }
  `;
  const data = await graphql(query, {
    accountTag: CF_ACCOUNT_ID,
    date,
    databaseId: D1_DATABASE_ID,
  });
  const rows = data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
  return rows.reduce(
    (totals, row) => ({
      rowsRead: totals.rowsRead + (row.sum?.rowsRead ?? 0),
      rowsWritten: totals.rowsWritten + (row.sum?.rowsWritten ?? 0),
    }),
    { rowsRead: 0, rowsWritten: 0 },
  );
}

function worstThreshold(fraction) {
  return THRESHOLDS.find((t) => fraction >= t.level) ?? null;
}

async function sendAlert(lines) {
  if (!WHATSAPP_ALERT_URL) {
    console.log("WHATSAPP_ALERT_URL not set, skipping alert delivery:\n" + lines.join("\n"));
    return;
  }
  const text = lines.join("\n");
  // Assumes a webhook relay that accepts a JSON POST { text }. If the
  // configured WhatsApp relay instead expects the message as a query
  // parameter on a GET request, swap this for:
  //   await fetch(`${WHATSAPP_ALERT_URL}${encodeURIComponent(text)}`);
  const res = await fetch(WHATSAPP_ALERT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Alert webhook returned ${res.status}`);
  }
}

async function main() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    throw new Error("CF_API_TOKEN and CF_ACCOUNT_ID are required");
  }

  const { start } = todayRangeUTC();
  const [workersRequests, d1] = await Promise.all([fetchWorkersRequests(start), fetchD1Usage(start)]);

  const metrics = [
    { name: "Workers requests", used: workersRequests, cap: CAPS.workersRequests },
    { name: "D1 rows read", used: d1.rowsRead, cap: CAPS.d1RowsRead },
    { name: "D1 rows written", used: d1.rowsWritten, cap: CAPS.d1RowsWritten },
  ];

  const alertLines = [];
  for (const m of metrics) {
    const fraction = m.used / m.cap;
    const pct = (fraction * 100).toFixed(1);
    console.log(`${m.name}: ${m.used} / ${m.cap} (${pct}%)`);
    const hit = worstThreshold(fraction);
    if (hit) {
      alertLines.push(`${m.name} at ${pct}% of today's free-tier cap (${m.used}/${m.cap})`);
    }
  }

  if (alertLines.length > 0) {
    await sendAlert([`Cloudflare usage alert for ${start}`, ...alertLines]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
