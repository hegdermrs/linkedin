import type { PlaybookConfig } from "@linkedin-agent/shared";
import { JIM_ATHLETES_PLAYBOOK } from "./jim-athletes.js";
import { JIM_WRESTLERS_PLAYBOOK } from "./jim-wrestlers.js";

export { JIM_WRESTLERS_PLAYBOOK, JIM_ATHLETES_PLAYBOOK };

export function getJimPlaybookByNiche(niche: string): PlaybookConfig | null {
  if (niche === "jim-wrestlers" || niche === "wrestlers") {
    return JIM_WRESTLERS_PLAYBOOK;
  }
  if (niche === "jim-athletes" || niche === "athletes") {
    return JIM_ATHLETES_PLAYBOOK;
  }
  return null;
}
