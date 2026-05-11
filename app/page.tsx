import HomeHeader from "../components/HomeHeader";
import TaskHero from "../components/TaskHero";
import AgentsScroll from "../components/AgentsScroll";
import ActiveTasks from "../components/ActiveTasks";
import RecentProjects from "../components/RecentProjects";

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <TaskHero />
      <AgentsScroll />
      <ActiveTasks />
      <RecentProjects />
    </>
  );
}
