import { t } from "@coaching-app/shared/i18n";
import { IconTray } from "@coaching-app/ui/icons";
import { Async, EmptyState, SyncNote } from "../components/ui";
import { pick } from "../lib/format";
import { useTests } from "../lib/queries";
import { go } from "../lib/router";

export function Tests() {
  const tests = useTests();

  return (
    <div class="screen">
      <h1 class="title">{t("test_zone")}</h1>
      <Async q={tests}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState icon={<IconTray size={40} />} text={t("no_tests")} />
          ) : (
            <div class="stack">
              <div class="list">
                {rows.map((row) => (
                  <div class="item">
                    <span class="name">{pick(row, "title")}</span>
                    <span class="meta">
                      {t("duration_min", { minutes: Math.round(row.duration_sec / 60) })} ·{" "}
                      {t("marks_total", { marks: row.total_marks })}
                      {row.negative_mark > 0 ? ` · ${t("negative_marking", { mark: row.negative_mark })}` : ""}
                    </span>
                    <span class="side">
                      {row.submitted_at ? (
                        <button class="btn small quiet" onClick={() => go(`tests/${row.id}/result`)}>
                          {t("view_result")} {row.score}/{row.total_marks}
                        </button>
                      ) : row.status === "closed" ? (
                        <span class="badge">{t("test_closed")}</span>
                      ) : (
                        <button class="btn small primary" onClick={() => go(`tests/${row.id}`)}>
                          {t("start_test")}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <SyncNote syncedAt={tests.syncedAt} isStale={tests.isStale} />
            </div>
          )
        }
      </Async>
    </div>
  );
}
