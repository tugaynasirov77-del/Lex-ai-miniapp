"use client";
import { useState } from "react";
import HomeHeader from "../components/HomeHeader";
import TaskInput from "../components/TaskInput";
import LiveActivity from "../components/LiveActivity";

export default function HomePage() {
  const [task, setTask] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <HomeHeader />
      <TaskInput onSubmit={(t) => setTask(t)} busy={busy} />
      <LiveActivity task={task} onReset={() => { setTask(null); setBusy(false); }} setBusy={setBusy} />
    </>
  );
}
