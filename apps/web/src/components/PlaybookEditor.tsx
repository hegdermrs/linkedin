"use client";

import { useState } from "react";
import type { PlaybookConfig } from "@linkedin-agent/shared";

const DEFAULT_CONFIG: PlaybookConfig = {
  brand: {
    businessName: "",
    senderPersona: "",
    tone: "casual",
    wordsToInclude: [],
    wordsToAvoid: [],
  },
  stages: {
    connect: { instructions: "", exampleTemplate: "" },
    intro: { instructions: "", exampleTemplate: "" },
    conversing: { instructions: "", exampleTemplate: "", pivotGoals: "" },
    call_offered: { instructions: "", exampleTemplate: "", calendlyUrl: "" },
    call_booked: { instructions: "", exampleTemplate: "" },
  },
  guardrails: {
    maxOutboundWithoutReply: 3,
    minDelayHours: 4,
    maxDelayHours: 48,
    maxDailyConnections: 15,
    maxDailyMessages: 50,
    maxDailyProfileViews: 80,
    businessHoursStart: 9,
    businessHoursEnd: 17,
    stopPhrases: ["not interested", "stop"],
    maxConnectionNoteChars: 300,
  },
};

export function PlaybookEditor({
  initial,
  onSave,
  onPublish,
  onPreview,
}: {
  initial: PlaybookConfig;
  onSave: (config: PlaybookConfig) => Promise<void>;
  onPublish: () => Promise<void>;
  onPreview: (config: PlaybookConfig) => Promise<{ messageText: string }>;
}) {
  const [config, setConfig] = useState<PlaybookConfig>({
    ...DEFAULT_CONFIG,
    ...initial,
  });
  const [tab, setTab] = useState<"brand" | "stages" | "guardrails">("brand");
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");

  function updateBrand(field: string, value: unknown) {
    setConfig((c) => ({
      ...c,
      brand: { ...c.brand, [field]: value },
    }));
  }

  function updateStage(
    stage: keyof PlaybookConfig["stages"],
    field: string,
    value: string
  ) {
    setConfig((c) => ({
      ...c,
      stages: {
        ...c.stages,
        [stage]: { ...c.stages[stage], [field]: value },
      },
    }));
  }

  function updateGuardrail(field: string, value: number | string[]) {
    setConfig((c) => ({
      ...c,
      guardrails: { ...c.guardrails, [field]: value },
    }));
  }

  return (
    <div>
      <div className="tabs">
        {(["brand", "stages", "guardrails"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "brand" && (
        <div className="card">
          <div className="form-group">
            <label>Business name</label>
            <input
              value={config.brand.businessName}
              onChange={(e) => updateBrand("businessName", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Sender persona</label>
            <textarea
              value={config.brand.senderPersona}
              onChange={(e) => updateBrand("senderPersona", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Tone</label>
            <select
              value={config.brand.tone}
              onChange={(e) => updateBrand("tone", e.target.value)}
            >
              <option value="casual">Casual</option>
              <option value="balanced">Balanced</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="form-group">
            <label>Words to include (comma-separated)</label>
            <input
              value={config.brand.wordsToInclude.join(", ")}
              onChange={(e) =>
                updateBrand(
                  "wordsToInclude",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </div>
          <div className="form-group">
            <label>Words to avoid (comma-separated)</label>
            <input
              value={config.brand.wordsToAvoid.join(", ")}
              onChange={(e) =>
                updateBrand(
                  "wordsToAvoid",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </div>
        </div>
      )}

      {tab === "stages" && (
        <div>
          {(
            [
              "connect",
              "intro",
              "conversing",
              "call_offered",
              "call_booked",
            ] as const
          ).map((stage) => (
            <div key={stage} className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem", textTransform: "capitalize" }}>
                {stage.replace("_", " ")}
              </h3>
              <div className="form-group">
                <label>Instructions</label>
                <textarea
                  value={config.stages[stage].instructions}
                  onChange={(e) =>
                    updateStage(stage, "instructions", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Example template ({"{{firstName}}"} etc.)</label>
                <textarea
                  value={config.stages[stage].exampleTemplate}
                  onChange={(e) =>
                    updateStage(stage, "exampleTemplate", e.target.value)
                  }
                />
              </div>
              {stage === "call_offered" && (
                <div className="form-group">
                  <label>Calendly URL</label>
                  <input
                    value={config.stages.call_offered.calendlyUrl ?? ""}
                    onChange={(e) =>
                      updateStage("call_offered", "calendlyUrl", e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "guardrails" && (
        <div className="card">
          <div className="form-group">
            <label>Max outbound without reply</label>
            <input
              type="number"
              value={config.guardrails.maxOutboundWithoutReply}
              onChange={(e) =>
                updateGuardrail(
                  "maxOutboundWithoutReply",
                  parseInt(e.target.value, 10)
                )
              }
            />
          </div>
          <div className="form-group">
            <label>Min delay between messages (hours)</label>
            <input
              type="number"
              value={config.guardrails.minDelayHours}
              onChange={(e) =>
                updateGuardrail("minDelayHours", parseInt(e.target.value, 10))
              }
            />
          </div>
          <div className="form-group">
            <label>Max daily connections</label>
            <input
              type="number"
              value={config.guardrails.maxDailyConnections}
              onChange={(e) =>
                updateGuardrail(
                  "maxDailyConnections",
                  parseInt(e.target.value, 10)
                )
              }
            />
          </div>
          <div className="form-group">
            <label>Max daily messages</label>
            <input
              type="number"
              value={config.guardrails.maxDailyMessages}
              onChange={(e) =>
                updateGuardrail("maxDailyMessages", parseInt(e.target.value, 10))
              }
            />
          </div>
          <div className="form-group">
            <label>Business hours start (0-23)</label>
            <input
              type="number"
              value={config.guardrails.businessHoursStart}
              onChange={(e) =>
                updateGuardrail(
                  "businessHoursStart",
                  parseInt(e.target.value, 10)
                )
              }
            />
          </div>
          <div className="form-group">
            <label>Business hours end (0-23)</label>
            <input
              type="number"
              value={config.guardrails.businessHoursEnd}
              onChange={(e) =>
                updateGuardrail(
                  "businessHoursEnd",
                  parseInt(e.target.value, 10)
                )
              }
            />
          </div>
          <div className="form-group">
            <label>Auto-stop phrases (comma-separated)</label>
            <input
              value={config.guardrails.stopPhrases.join(", ")}
              onChange={(e) =>
                updateGuardrail(
                  "stopPhrases",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={async () => {
            await onSave(config);
            setStatus("Draft saved.");
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            const r = await onPreview(config);
            setPreview(r.messageText);
            setStatus("Preview generated.");
          }}
        >
          Preview reply
        </button>
        <button
          type="button"
          onClick={async () => {
            await onPublish();
            setStatus("Published — worker will use new version.");
          }}
        >
          Publish
        </button>
      </div>

      {status && (
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>{status}</p>
      )}
      {preview && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Preview message</h3>
          <p>{preview}</p>
        </div>
      )}
    </div>
  );
}
