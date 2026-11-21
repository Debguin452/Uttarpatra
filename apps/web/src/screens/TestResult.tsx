import { t } from "@coaching-app/shared/i18n";
import { IconTrophy } from "@coaching-app/ui/icons";
import { TestReview } from "../components/TestReview";
import { Async, CountUp, EmptyState, SyncNote } from "../components/ui";
import { clock, pick } from "../lib/format";
import { useLeaderboard, useTestResult } from "../lib/queries";
import { go } from "../lib/router";
import { uid } from "../lib/session";

export function TestResult({ testId }: { testId: string }) {
  const result = useTestResult(testId);
  const leaderboard = useLeaderboard(testId);
  const me = uid();

  return (
    <div class="screen">
      <Async q={result}>
        {(r) => (
          <>
            <header class="stack">
              <p class="eyebrow">{t("results")}</p>
              <h1 class="title">{pick({ title_bn: r.titleBn, title_en: r.titleEn }, "title")}</h1>
            </header>

            <div>
              <span class="score">
                <CountUp value={r.score} />
              </span>
              <span class="muted"> / {r.totalMarks}</span>
            </div>

            {r.rank !== null && (
              <div class="rank-badge">
                <span class="num">
                  #<CountUp value={r.rank} />
                </span>
                <span class="muted small">{t("your_rank", { rank: r.rank, total: r.totalParticipants })}</span>
              </div>
            )}

            <div class="stats">
              <div>
                <span class="muted small">{t("correct")}</span>
                <strong>{r.correct}</strong>
              </div>
              <div>
                <span class="muted small">{t("wrong")}</span>
                <strong>{r.wrong}</strong>
              </div>
              <div>
                <span class="muted small">{t("skipped")}</span>
                <strong>{r.skipped}</strong>
              </div>
            </div>
            <p class="muted small">
              {t("time_taken")}: {clock(r.timeTakenSec)}
            </p>

            <TestReview testId={testId} />

            <section class="stack">
              <h2 class="subtitle">{t("leaderboard")}</h2>
              <Async q={leaderboard}>
                {(rows) =>
                  rows.length === 0 ? (
                    <EmptyState icon={<IconTrophy size={36} />} text={t("no_leaderboard")} />
                  ) : (
                    <div class="stack">
                      <div class="list">
                        {rows.map((row, i) => (
                          <div
                            key={row.uid}
                            class={row.uid === me ? "leaderboard-row me" : "leaderboard-row"}
                            style={{ "--row-i": i }}
                          >
                            <span class="num">#{row.rank}</span>
                            <span class="name">{row.uid === me ? t("you") : row.name}</span>
                            <span class="muted">{row.score}</span>
                          </div>
                        ))}
                      </div>
                      <SyncNote syncedAt={leaderboard.syncedAt} isStale={leaderboard.isStale} />
                    </div>
                  )
                }
              </Async>
            </section>

            <button class="btn primary block" onClick={() => go("tests")}>
              {t("back_to_tests")}
            </button>
          </>
        )}
      </Async>
    </div>
  );
}
