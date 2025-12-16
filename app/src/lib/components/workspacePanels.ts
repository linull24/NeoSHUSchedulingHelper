import CourseCalendarPanel from "../apps/CourseCalendarPanel.svelte";
import CandidateExplorerPanel from "../apps/CandidateExplorerPanel.svelte";
import SelectedCoursesPanel from "../apps/SelectedCoursesPanel.svelte";
import AllCoursesPanel from "../apps/AllCoursesPanel.svelte";
import SolverPanel from "../apps/SolverPanel.svelte";
import ActionLogPanel from "../apps/ActionLogPanel.svelte";
import SyncPanel from "../apps/SyncPanel.svelte";
import JwxtPanel from "../apps/JwxtPanel.svelte";
import SettingsPanel from "../apps/SettingsPanel.svelte";

export const workspacePanels = {
  "course-calendar": CourseCalendarPanel,
  "all-courses": AllCoursesPanel,
  "candidates": CandidateExplorerPanel,
  "selected": SelectedCoursesPanel,
  "solver": SolverPanel,
  "action-log": ActionLogPanel,
  "sync": SyncPanel,
  "jwxt": JwxtPanel,
  "settings": SettingsPanel
} as const;

export type WorkspacePanelType = keyof typeof workspacePanels;

export const orderedWorkspacePanels: WorkspacePanelType[] = [
  "course-calendar",
  "all-courses",
  "candidates",
  "selected",
  "solver",
  "action-log",
  "sync",
  "jwxt",
  "settings"
];
