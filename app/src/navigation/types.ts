export type RootStackParamList = {
  Tabs: undefined;
  Story: { id: string };
  // Compose is presented modally over Story View (wireframe frame 12). Built minimally in
  // Phase 4 Task 4 to keep the submit loop working; fully designed in Task 5.
  Compose: { id: string };
};

export type TabsParamList = {
  Stories: undefined;
  Discover: undefined;
  Profile: undefined;
};

// Auth flow (outside the tab shell). The First-story prompt + the status-driven gate land in Task 4.
export type AuthStackParamList = {
  Welcome: undefined;
  HandlePick: undefined;
};
