export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">V-Unite Voice AI Coach</h1>
      <p className="text-sm leading-relaxed opacity-70">
        Foundation scaffold. Chat, voice, RAG, and coaching features are built in later
        phases — see <code>docs/DEVELOPMENT_PLAN.md</code>. This page exists so the app
        builds, lints, type-checks, and deploys before any intelligence is layered on top.
      </p>
    </main>
  );
}
