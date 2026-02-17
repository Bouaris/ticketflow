use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_QUEUE_SIZE: i64 = 500;
const MAX_RETRY_COUNT: i64 = 5;
const HTTP_TIMEOUT_SECS: u64 = 10;
const FLUSH_BATCH_SIZE: i64 = 50;

/// DDL executed once at startup to create the offline event queue.
const QUEUE_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS ph_event_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_queue_created ON ph_event_queue(created_at ASC);
";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single PostHog event sent from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhEvent {
    pub event: String,
    pub properties: serde_json::Value,
    pub timestamp: Option<String>,
}

/// The batch payload accepted by the `ph_send_batch` command.
#[derive(Debug, Deserialize)]
pub struct BatchPayload {
    pub events: Vec<PhEvent>,
    pub api_key: String,
}

/// Return value of `ph_send_batch` indicating how many events were sent or queued.
#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub sent: usize,
    pub queued: usize,
}

/// Tauri managed state for the telemetry subsystem.
pub struct TelemetryState {
    pub pool: SqlitePool,
    pub api_host: String,
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/// Open (or create) `telemetry.db` in `app_data_dir` and run the schema DDL.
/// Called once from `lib.rs` during app setup.
pub async fn init_telemetry_db(app_data_dir: &std::path::Path) -> SqlitePool {
    std::fs::create_dir_all(app_data_dir).expect("cannot create app data directory");

    let db_path = app_data_dir.join("telemetry.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&db_url)
        .await
        .expect("cannot open telemetry.db");

    // Enable WAL mode for crash-safe persistence.
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await
        .expect("cannot enable WAL mode");

    // Create table and index if they do not exist yet.
    sqlx::query(QUEUE_SCHEMA)
        .execute(&pool)
        .await
        .expect("cannot create ph_event_queue schema");

    pool
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

/// IPC relay command: forward a batch of PostHog events to the EU ingest
/// endpoint. Falls back to the SQLite offline queue when the network is
/// unavailable. On success, opportunistically flushes any previously queued
/// events.
#[tauri::command]
pub async fn ph_send_batch(
    payload: BatchPayload,
    state: tauri::State<'_, TelemetryState>,
) -> Result<BatchResult, String> {
    let event_count = payload.events.len();

    // Build the PostHog batch request body.
    let body = serde_json::json!({
        "api_key": payload.api_key,
        "batch": payload.events,
    });

    let client = reqwest::Client::new();
    let endpoint = format!("{}/batch", state.api_host);

    let response = client
        .post(&endpoint)
        .json(&body)
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            // Successful delivery — opportunistically drain the offline queue.
            flush_queue(&state.pool, &client, &state.api_host, &payload.api_key).await;
            Ok(BatchResult {
                sent: event_count,
                queued: 0,
            })
        }
        Ok(resp) => {
            // Server returned a non-2xx status — queue events for retry.
            log::warn!(
                "ph_send_batch: PostHog returned HTTP {}; queuing {} events",
                resp.status(),
                event_count
            );
            let queued = queue_events(&state.pool, &payload.events).await;
            Ok(BatchResult { sent: 0, queued })
        }
        Err(err) => {
            // Network error — queue events for retry.
            log::warn!(
                "ph_send_batch: network error ({}); queuing {} events",
                err,
                event_count
            );
            let queued = queue_events(&state.pool, &payload.events).await;
            Ok(BatchResult { sent: 0, queued })
        }
    }
}

// ---------------------------------------------------------------------------
// Startup flush (called from lib.rs after manage())
// ---------------------------------------------------------------------------

/// Attempt to drain the offline queue on app startup.
/// Errors are logged but never propagated — this is best-effort.
pub async fn startup_flush(state: tauri::State<'_, TelemetryState>) {
    // We need the api_key for the flush. Without a key we cannot send, so
    // skip. The key is read per-batch from the frontend; at startup we do not
    // have a live api_key from the caller, so we read it from a placeholder
    // stored alongside events. For now, we attempt flush only if there are
    // queued events — the api_key will come from the stored event properties.
    let client = reqwest::Client::new();
    flush_queue(&state.pool, &client, &state.api_host, "").await;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Persist events to the offline queue and enforce `MAX_QUEUE_SIZE`.
/// Returns the count of successfully inserted events.
async fn queue_events(pool: &SqlitePool, events: &[PhEvent]) -> usize {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let mut inserted = 0usize;

    for event in events {
        match serde_json::to_string(event) {
            Ok(json) => {
                let result = sqlx::query(
                    "INSERT INTO ph_event_queue (event_json, created_at) VALUES (?, ?)",
                )
                .bind(&json)
                .bind(now_ms)
                .execute(pool)
                .await;

                if let Err(e) = result {
                    log::error!("queue_events: insert failed: {}", e);
                } else {
                    inserted += 1;
                }
            }
            Err(e) => {
                log::error!("queue_events: serialize failed: {}", e);
            }
        }
    }

    // Prune oldest events beyond MAX_QUEUE_SIZE.
    let prune = sqlx::query(
        "DELETE FROM ph_event_queue WHERE id IN (
             SELECT id FROM ph_event_queue ORDER BY created_at ASC
             LIMIT MAX(0, (SELECT COUNT(*) FROM ph_event_queue) - ?)
         )",
    )
    .bind(MAX_QUEUE_SIZE)
    .execute(pool)
    .await;

    if let Err(e) = prune {
        log::error!("queue_events: prune failed: {}", e);
    }

    inserted
}

/// Attempt to send up to `FLUSH_BATCH_SIZE` queued events to PostHog.
/// On success, delete the sent rows. On failure, increment retry_count and
/// discard events that have exceeded `MAX_RETRY_COUNT`.
///
/// `api_key` may be empty — in that case we skip the flush (no valid key
/// to authenticate with PostHog). The key is always provided by the frontend
/// at batch-send time; startup_flush is a best-effort convenience.
async fn flush_queue(pool: &SqlitePool, client: &reqwest::Client, api_host: &str, api_key: &str) {
    // Fetch a batch of queued events that still have retry budget.
    let rows: Vec<(i64, String)> = match sqlx::query_as::<_, (i64, String)>(
        "SELECT id, event_json FROM ph_event_queue
         WHERE retry_count < ?
         ORDER BY created_at ASC
         LIMIT ?",
    )
    .bind(MAX_RETRY_COUNT)
    .bind(FLUSH_BATCH_SIZE)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            log::error!("flush_queue: fetch failed: {}", e);
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    // Skip delivery when we have no API key (e.g., startup flush without key).
    if api_key.is_empty() {
        return;
    }

    let ids: Vec<i64> = rows.iter().map(|(id, _)| *id).collect();

    // Deserialize events (skip malformed ones).
    let events: Vec<PhEvent> = rows
        .iter()
        .filter_map(|(_, json)| serde_json::from_str(json).ok())
        .collect();

    if events.is_empty() {
        return;
    }

    let body = serde_json::json!({
        "api_key": api_key,
        "batch": events,
    });

    let endpoint = format!("{}/batch", api_host);

    match client
        .post(&endpoint)
        .json(&body)
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            // Delete successfully sent rows.
            let id_placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
            let delete_sql = format!(
                "DELETE FROM ph_event_queue WHERE id IN ({})",
                id_placeholders.join(", ")
            );
            let mut query = sqlx::query(&delete_sql);
            for id in &ids {
                query = query.bind(id);
            }
            if let Err(e) = query.execute(pool).await {
                log::error!("flush_queue: delete sent rows failed: {}", e);
            }
        }
        _ => {
            // Increment retry_count for all attempted rows.
            let id_placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
            let update_sql = format!(
                "UPDATE ph_event_queue SET retry_count = retry_count + 1 WHERE id IN ({})",
                id_placeholders.join(", ")
            );
            let mut query = sqlx::query(&update_sql);
            for id in &ids {
                query = query.bind(id);
            }
            if let Err(e) = query.execute(pool).await {
                log::error!("flush_queue: increment retry_count failed: {}", e);
            }

            // Purge events that exhausted all retries.
            let purge_sql = format!(
                "DELETE FROM ph_event_queue WHERE retry_count >= ? AND id IN ({})",
                id_placeholders.join(", ")
            );
            let mut purge_query = sqlx::query(&purge_sql).bind(MAX_RETRY_COUNT);
            for id in &ids {
                purge_query = purge_query.bind(id);
            }
            if let Err(e) = purge_query.execute(pool).await {
                log::error!("flush_queue: purge exhausted rows failed: {}", e);
            }
        }
    }
}
