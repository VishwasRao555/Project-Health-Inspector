/**
 * Seam #1. Hides *how* a repository arrives (clone vs unzip) behind one method.
 * Both adapters yield a local directory plus a cleanup handle.
 */
export interface RepoHandle {
  rootDir: string;
  cleanup(): Promise<void>;
}

export interface RepositorySource {
  materialize(): Promise<RepoHandle>;
}
