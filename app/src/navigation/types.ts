export type RootStackParamList = {
  // Auth flow (shown by the status-driven gate; outside the tab shell).
  Splash: undefined;
  Welcome: undefined;
  HandlePick: undefined;
  // App (shown once authed with a handle).
  Tabs: undefined;
  Story: { id: string };
  // Compose is presented modally over Story View (wireframe frame 12).
  Compose: { id: string };
};

export type TabsParamList = {
  Stories: undefined;
  Discover: undefined;
  Profile: undefined;
};
