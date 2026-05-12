"use client";
import { useState } from "react";
import HomeHeader from "../components/HomeHeader";
import TaskInput from "../components/TaskInput";
import LiveActivity from "../components/LiveActivity";
import AgentsGrid from "../components/AgentsGrid";
import MetricsRow from "../components/MetricsRow";
import ResultsList from "../components/ResultsList";

export default function HomePage() {
  const [task, setTask] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <HomeHeader />
      <TaskInput onSubmit={(t) => setTask(t)} busy={busy} />
      <LiveActivity task={task} onReset={() => { setTask(null); setBusy(false); }} setBusy={setBusy} />
      <AgentsGrid />
      <MetricsRow />
      <ResultsList />
    </>
  );
}
