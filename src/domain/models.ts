export type EditorVersion = {
  readonly value: string;
};

export type GitBranch =
  | { readonly type: 'branch'; readonly name: string }
  | { readonly type: 'detached'; readonly sha: string };

export type GitRepositoryInfo = {
  readonly root: string;
  readonly branch?: GitBranch;
};

export type UnityProject = {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly version: EditorVersion;
  readonly lastModified?: Date;
  readonly favorite: boolean;
};

export type UnityProcess = {
  readonly pid: number;
  readonly projectPath: string;
};
