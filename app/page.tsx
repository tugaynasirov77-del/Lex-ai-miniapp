import HomeHeader from "../components/HomeHeader";
import TaskHero from "../components/TaskHero";
import AgentsScroll from "../components/AgentsScroll";
import ActiveTasks from "../components/ActiveTasks";
import RecentProjects from "../components/RecentProjects";
import QuickActions from "../components/QuickActions";

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <TaskHero />
      <AgentsScroll />
      <ActiveTasks />
      <RecentProjects />
      <QuickActions />
    </>
  );
}
