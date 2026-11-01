// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Error {
      message: string;
      incidentId?: string;
    }
    /** Shallow-routing state: the atlas is open in full-screen mode, so the Back button closes it. */
    interface PageState {
      atlasImmersive?: boolean;
    }
  }
}
export {};
